import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import postcss, { type ChildNode } from "postcss";
import { compile } from "tailwindcss";
import ts from "typescript";
import { axisOf, expand, isViolation, judge, trace, type Scope, type Token } from "@conform/core";
import { inside, type Project } from "./project.ts";

const require = createRequire(import.meta.url);

export interface Note { line: number; element: string; prop: string; rule: string; wrote: string; allowed: string[] }

interface Decl { prop: string; value: string }

/**
 * A fast check of one file before the pull request opens. It reads class names and inline styles without a browser,
 * so it sees less than the review does: no inheritance, no cascade between files, no accessibility.
 */
export async function checkFile(project: Project, file: string): Promise<Note[]> {
  const full = inside(project.root, file);
  const source = await readFile(full, "utf8");
  if (full.endsWith(".css")) return checkCss(project, source);
  if (!/\.[jt]sx$/.test(full)) throw new Error("check_file reads .tsx, .jsx and .css files");
  const sf = ts.createSourceFile(full, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Array<{ line: number; tag: string; attrs: Map<string, string>; classes: string[]; inline: Decl[]; modules: string[] }> = [];
  const imports = new Map<string, string>();
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && n.importClause?.name && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.endsWith(".module.css")) imports.set(n.importClause.name.text, n.moduleSpecifier.text);
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const el = { line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, tag: n.tagName.getText(), attrs: new Map<string, string>(), classes: [] as string[], inline: [] as Decl[], modules: [] as string[] };
      for (const a of n.attributes.properties) {
        if (!ts.isJsxAttribute(a) || !ts.isIdentifier(a.name)) continue;
        const name = a.name.text;
        const init = a.initializer;
        if (name === "className" && init) {
          const texts: string[] = [];
          const collect = (m: ts.Node): void => {
            if (ts.isStringLiteralLike(m)) texts.push(m.text);
            if (ts.isTemplateHead(m) || ts.isTemplateMiddle(m) || ts.isTemplateTail(m)) texts.push(m.text);
            if (ts.isPropertyAccessExpression(m) && ts.isIdentifier(m.expression) && imports.has(m.expression.text)) el.modules.push(`${m.expression.text}.${m.name.text}`);
            ts.forEachChild(m, collect);
          };
          collect(init);
          el.classes.push(...texts.join(" ").split(/\s+/).filter(Boolean));
        } else if (name === "style" && init) {
          const collect = (m: ts.Node): void => {
            if (ts.isPropertyAssignment(m) && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name))) {
              const prop = m.name.text.startsWith("--") ? m.name.text : m.name.text.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
              if (ts.isStringLiteralLike(m.initializer)) el.inline.push({ prop, value: m.initializer.text });
              if (ts.isNumericLiteral(m.initializer)) el.inline.push({ prop, value: `${m.initializer.text}px` });
            }
            ts.forEachChild(m, collect);
          };
          collect(init);
        } else el.attrs.set(name, init && ts.isStringLiteral(init) ? init.text : "");
      }
      found.push(el);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  const util = project.styling === "tailwind" ? await utilities(project, [...new Set(found.flatMap((f) => f.classes))]) : { classes: new Map<string, Decl[]>(), vars: new Map<string, string>() };
  const modules = new Map<string, Map<string, Decl[]>>();
  for (const [name, spec] of imports) {
    const css = await readFile(inside(project.root, path.resolve(path.dirname(full), spec)), "utf8");
    modules.set(name, classRules(css));
  }
  const notes: Note[] = [];
  for (const el of found) {
    // Each class is judged alone: in `a ? "gap-2" : "gap-small"` either one may be the one that renders.
    const groups: Decl[][] = [
      ...el.classes.map((c) => util.classes.get(c) ?? []),
      ...el.modules.map((m) => modules.get(m.split(".")[0]!)?.get(m.split(".")[1]!) ?? []),
      el.inline,
    ];
    const decls = groups.flat();
    const part = partOf(project, el.tag, el.attrs);
    // A component's own element is checked where the component is defined.
    if (/^[A-Z]/.test(el.tag)) continue;
    const locals = new Map([...util.vars, ...el.inline.filter((d) => d.prop.startsWith("--")).map((d) => [d.prop, d.value] as const)]);
    for (const g of groups) notes.push(...judgeDecls(project, g, locals, part).map((x) => ({ line: el.line, element: el.tag, ...x })));
    for (const prop of project.bundle.contract.parts.find((p) => p.part === part)?.required ?? []) {
      if (!decls.some((d) => expand(d.prop, d.value).some(([p]) => p === prop))) notes.push({ line: el.line, element: el.tag, prop, rule: "literal-value", wrote: "(not declared)", allowed: project.bundle.contract.parts.find((p) => p.part === part)!.props[prop] ?? [] });
    }
  }
  return notes;
}

function checkCss(project: Project, css: string): Note[] {
  const notes: Note[] = [];
  const vars = new Map<string, string>();
  const root = postcss.parse(css);
  root.walkDecls(/^--/, (d) => void vars.set(d.prop, d.value));
  root.walkRules((r) => {
    const decls = (r.nodes as ChildNode[]).filter((n) => n.type === "decl").map((d) => ({ prop: d.prop, value: d.value }));
    notes.push(...judgeDecls(project, decls, vars, null).map((x) => ({ line: r.source?.start?.line ?? 0, element: r.selector, ...x })));
  });
  return notes;
}

function judgeDecls(project: Project, decls: Decl[], vars: Map<string, string>, part: string | null): Array<Omit<Note, "line" | "element">> {
  const tokens = new Map<string, Token>(project.bundle.tokens.map((t) => [t.name, t]));
  const byVar = new Map(project.bundle.tokens.map((t) => [t.cssVar, t]));
  const local = new Map([...vars, ...decls.filter((d) => d.prop.startsWith("--")).map((d) => [d.prop, d.value] as const)]);
  const scope: Scope<0> = {
    lookup: (name) => {
      const t = byVar.get(name);
      const v = local.get(name) ?? t?.values[project.bundle.themes[0]!];
      return v === undefined ? undefined : { value: v, at: 0 };
    },
    token: (v) => byVar.get(v)?.name,
  };
  const out: Array<Omit<Note, "line" | "element">> = [];
  for (const d of decls) if (byVar.has(d.prop)) out.push({ prop: d.prop, rule: "token-redefined", wrote: d.value, allowed: [] });
  const won = new Map<string, string | null>();
  for (const d of decls) for (const [p, text] of expand(d.prop, d.value)) won.set(p, text);
  const seen = new Set<string>();
  for (const [p, text] of won) {
    const prop = axisOf(p);
    const t = text === null ? ({ kind: "unresolved", reason: "shorthand" } as const) : trace(text, 0, scope);
    const verdict = judge(project.bundle.contract, tokens, part, prop, t);
    if (!verdict || !isViolation(verdict)) continue;
    const key = `${prop}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const allowed = project.bundle.contract.parts.find((x) => x.part === part)?.props[prop] ?? project.bundle.contract.any[prop] ?? [];
    out.push({ prop, rule: verdict, wrote: text ?? "", allowed });
  }
  return out;
}

/** Selectors in the contract are simple enough to match without a DOM: a tag, a role, or an attribute. */
function partOf(project: Project, tag: string, attrs: Map<string, string>): string | null {
  for (const p of project.bundle.contract.parts) {
    for (const sel of p.selector.split(",").map((s) => s.trim())) {
      const m = /^(?:[a-z0-9]+ )?([a-z0-9]+)?((?::not\(\[[^\]]+\]\)|\[[^\]]+\])*)$/i.exec(sel);
      if (!m || (m[1] && m[1] !== tag)) continue;
      const conds = [...m[2]!.matchAll(/(:not\()?\[([\w-]+)(?:="?([^\]"]+)"?)?\]/g)];
      if (!m[1] && conds.length === 0) continue;
      const ok = conds.every(([, not, name, value]) => {
        const hit = value === undefined ? attrs.has(name!) : attrs.get(name!) === value;
        return not ? !hit : hit;
      });
      if (ok) return p.part;
    }
  }
  return null;
}

async function utilities(project: Project, candidates: string[]): Promise<{ classes: Map<string, Decl[]>; vars: Map<string, string> }> {
  const dir = path.dirname(require.resolve("tailwindcss/package.json"));
  const compiler = await compile(`@import "tailwindcss/theme.css" layer(theme);\n${project.themeCss}\n@import "tailwindcss/utilities.css" layer(utilities) source(none);`, {
    base: project.root,
    loadModule: async () => {
      throw new Error("plugins are not allowed");
    },
    loadStylesheet: async (id) => {
      const file = path.join(dir, path.basename(id));
      return { path: file, base: dir, content: await readFile(file, "utf8") };
    },
  });
  const root = postcss.parse(compiler.build(candidates));
  const vars = new Map<string, string>();
  root.walkDecls(/^--/, (d) => {
    if (d.parent?.type === "rule" && /:root/.test((d.parent as postcss.Rule).selector)) vars.set(d.prop, d.value);
  });
  root.walkAtRules("property", (r) => {
    const init = r.nodes?.find((n) => n.type === "decl" && n.prop === "initial-value");
    if (init?.type === "decl") vars.set(r.params.trim(), init.value);
  });
  return { classes: classRules(root.toString()), vars };
}

/** Class name to the declarations directly in its rule. Nested states and media queries are left to the review. */
function classRules(css: string): Map<string, Decl[]> {
  const out = new Map<string, Decl[]>();
  postcss.parse(css).walkRules((r) => {
    const m = /^\.((?:\\.|[\w-])+)$/.exec(r.selector);
    if (!m || !r.nodes) return;
    const name = m[1]!.replace(/\\(.)/g, "$1");
    const decls = (r.nodes as ChildNode[]).filter((n) => n.type === "decl").map((d) => ({ prop: d.prop, value: d.value }));
    out.set(name, [...(out.get(name) ?? []), ...decls]);
  });
  return out;
}
