import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import type { Browser, CDPSession } from "playwright-core";
import {
  axisOf, COMPUTED, expand, isNeutral, judge, trace,
  type Decision, type Flow, type Finding, type Scope, type Token, type Trace,
} from "@conform/core";
import type { Policy } from "./config.ts";
import type { BuiltScreen } from "./build.ts";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const ORIGIN = "http://conform.invalid";

export interface Inspection {
  decisions: Decision[];
  extra: Finding[];
  /** Requests the page tried to make. All are refused. */
  blockedRequests: number;
}

interface CssProperty { name: string; value: string; text?: string; disabled?: boolean; parsedOk?: boolean; important?: boolean }
interface CssStyle { cssProperties: CssProperty[]; styleSheetId?: string }
interface RuleMatch { rule: { origin: string; styleSheetId?: string; style: CssStyle } }
interface Matched {
  inlineStyle?: CssStyle;
  matchedCSSRules?: RuleMatch[];
  inherited?: Array<{ inlineStyle?: CssStyle; matchedCSSRules: RuleMatch[] }>;
}
interface Decl { prop: string; value: string; important: boolean; trusted: boolean }

/** A value no real token has, different for every token, so the computed value names the token behind it. */
function sentinel(type: Token["type"], i: number): string {
  switch (type) {
    case "color": return `rgb(${1 + (i % 7)}, ${2 + Math.floor(i / 7)}, 3)`;
    case "dimension": return `${137.25 + i}px`;
    case "number": return `${0.37 + i / 1000}`;
    case "fontWeight": return `${111 + i}`;
    case "shadow": return `0px ${i + 1}px 7px 0px rgb(1, 2, 3)`;
  }
}

const STATES = [
  { id: "hover", force: ["hover"] },
  { id: "focus", force: ["focus", "focus-visible"] },
] as const;
const STATE_PROPS = new Set(["background-color", "color", "border-color", "box-shadow"]);

export async function inspectScreen(browser: Browser, policy: Policy, screen: BuiltScreen): Promise<Inspection> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
  let blocked = 0;
  try {
    await ctx.route("**/*", async (route) => {
      const url = route.request().url();
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${screen.id}</title><link rel="icon" href="data:,"><link rel="stylesheet" href="${ORIGIN}/ds.css"><link rel="stylesheet" href="${ORIGIN}/app.css"></head><body><div id="root"></div><script src="${ORIGIN}/app.js"></script></body></html>`;
      const files: Record<string, [string, string]> = {
        [`${ORIGIN}/`]: ["text/html", html],
        [`${ORIGIN}/ds.css`]: ["text/css", screen.dsCss],
        [`${ORIGIN}/app.css`]: ["text/css", screen.appCss],
        [`${ORIGIN}/app.js`]: ["text/javascript", screen.js],
      };
      const hit = files[url];
      if (hit) return route.fulfill({ contentType: hit[0], body: hit[1] });
      blocked++;
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const cdp = await ctx.newCDPSession(page);
    const sheets = new Map<string, string>();
    cdp.on("CSS.styleSheetAdded", (e: { header: { styleSheetId: string; sourceURL: string } }) => sheets.set(e.header.styleSheetId, e.header.sourceURL));
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
    await page.waitForFunction("document.getElementById('root').childElementCount > 0", undefined, { timeout: 10_000 }).catch(() => {
      throw new Error(`screen ${screen.id} rendered nothing${errors.length ? `: ${errors[0]}` : ""}`);
    });
    const inspector = new Inspector(cdp, policy, screen, sheets);
    await inspector.init();
    const decisions: Decision[] = [];
    const extra: Finding[] = [...inspector.redefinedTokens()];
    for (const theme of policy.bundle.themes) {
      await inspector.setTheme(theme);
      decisions.push(...(await inspector.decisions(theme)));
      extra.push(...(await inspector.accessibility(theme)));
    }
    extra.push(...(await inspector.tampering()));
    return { decisions, extra: mergeThemes(extra), blockedRequests: blocked };
  } finally {
    await ctx.close();
  }
}

/** The same finding in several themes is one finding. */
function mergeThemes(list: Finding[]): Finding[] {
  const byId = new Map<string, Finding>();
  for (const f of list) {
    const seen = byId.get(f.id);
    if (seen) seen.themes = [...new Set([...seen.themes, ...f.themes])].sort();
    else byId.set(f.id, { ...f });
  }
  return [...byId.values()];
}

class Inspector {
  private readonly cdp: CDPSession;
  private readonly policy: Policy;
  private readonly screen: BuiltScreen;
  private readonly sheets: Map<string, string>;
  private readonly tokens: Map<string, Token>;
  private readonly byVar: Map<string, string>;
  private readonly registered: Map<string, { initial?: string; inherits: boolean }>;
  private world = 0;

  constructor(cdp: CDPSession, policy: Policy, screen: BuiltScreen, sheets: Map<string, string>) {
    this.cdp = cdp;
    this.policy = policy;
    this.screen = screen;
    this.sheets = sheets;
    this.registered = registrations(screen.appCss);
    this.tokens = new Map(policy.bundle.tokens.map((t) => [t.name, t]));
    this.byVar = new Map(policy.bundle.tokens.map((t) => [t.cssVar, t.name]));
  }

  /** An isolated world: the page's own scripts can't patch what the checker reads. */
  async init(): Promise<void> {
    const { frameTree } = await this.cdp.send("Page.getFrameTree");
    const { executionContextId } = await this.cdp.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "conform" });
    this.world = executionContextId;
    await this.eval(HELPERS);
    await this.eval(AXE);
  }

  private async eval<T>(expression: string): Promise<T> {
    const r = await this.cdp.send("Runtime.evaluate", { expression, contextId: this.world, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  }

  async setTheme(theme: string): Promise<void> {
    await this.eval(`document.documentElement.setAttribute("data-theme", ${JSON.stringify(theme)})`);
  }

  async decisions(theme: string): Promise<Decision[]> {
    const parts = this.policy.bundle.contract.parts.map((p) => ({ part: p.part, selector: p.selector, required: p.required ?? [] }));
    const els = await this.eval<Array<{ part: string | null; path: string; repeat: boolean; flow: Flow }>>(`__c.collect(${JSON.stringify(parts)})`);
    const handle = await this.cdp.send("Runtime.evaluate", { expression: "__c.els", contextId: this.world });
    const props = await this.cdp.send("Runtime.getProperties", { objectId: handle.result.objectId!, ownProperties: true });
    const objectIds = props.result.filter((p) => /^\d+$/.test(p.name)).sort((a, b) => Number(a.name) - Number(b.name)).map((p) => p.value!.objectId!);
    await this.cdp.send("DOM.getDocument", { depth: 0 });
    const raw: Candidate[] = [];
    for (let i = 0; i < els.length; i++) {
      const { nodeId } = await this.cdp.send("DOM.requestNode", { objectId: objectIds[i]! });
      const meta = els[i]!;
      const rest = await this.forNode(nodeId, meta.part, meta.flow);
      const push = (state: Decision["state"], x: Judged): void => {
        raw.push({
          screen: this.screen.id, path: meta.path, part: meta.part, prop: axisOf(x.prop), state, theme,
          longhand: x.prop, declared: x.declared, trace: x.trace, verdict: x.verdict, valueMatch: false, el: i, repeat: meta.repeat, computedProp: COMPUTED[x.prop] ?? x.prop,
        });
      };
      for (const x of rest) push("rest", x);
      if (meta.part) {
        for (const s of STATES) {
          await this.cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [...s.force] });
          const forced = (await this.forNode(nodeId, meta.part, meta.flow)).filter((x) => STATE_PROPS.has(x.prop) && x.verdict !== null);
          await this.cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
          for (const x of forced) {
            if (!rest.some((r) => r.prop === x.prop && r.declared === x.declared)) push(s.id, x);
          }
        }
        for (const prop of this.policy.bundle.contract.parts.find((p) => p.part === meta.part)?.required ?? []) {
          if (!rest.some((r) => r.prop === prop)) push("rest", { prop, declared: "(not declared)", trace: { kind: "literal", value: "(not declared)" }, verdict: "literal-value" });
        }
      }
    }
    await this.confirm(raw, theme);
    return fold(raw).map(({ el: _el, computedProp: _cp, repeat: _r, verdict, ...d }) => ({ ...d, verdict: verdict! }));
  }

  private async forNode(nodeId: number, part: string | null, flow: Flow): Promise<Judged[]> {
    const m = (await this.cdp.send("CSS.getMatchedStylesForNode", { nodeId })) as unknown as Matched;
    const scopes: Decl[][] = [
      this.decls(m.matchedCSSRules ?? [], m.inlineStyle),
      ...(m.inherited ?? []).map((s) => this.decls(s.matchedCSSRules, s.inlineStyle)),
    ];
    const registered = this.registered;
    const scope: Scope<number> = {
      lookup: (name, at) => {
        const reg = registered.get(name);
        const last = reg && !reg.inherits ? at : scopes.length - 1;
        for (let i = at; i <= last; i++) {
          const d = winner(scopes[i]!, name);
          if (d) return { value: d.value, at: i };
        }
        return reg?.initial ? { value: reg.initial, at } : undefined;
      },
      token: (v) => this.byVar.get(v),
    };
    const winners = new Map<string, { text: string | null; decl: Decl }>();
    for (const pass of [false, true]) {
      for (const d of scopes[0]!) {
        if (d.important !== pass || d.prop.startsWith("--")) continue;
        for (const [p, text] of expand(d.prop, d.value, flow)) winners.set(p, { text, decl: d });
      }
    }
    const out: Judged[] = [];
    for (const [prop, { text, decl }] of winners) {
      if (decl.trusted) continue;
      const t: Trace = text === null ? { kind: "unresolved", reason: `${decl.prop} shorthand can't be split` } : trace(text, 0, scope);
      const verdict = judge(this.policy.bundle.contract, this.tokens, part, axisOf(prop), t);
      // A neutral answer reached through a variable or a cascade keyword has to survive the probe before it is dropped.
      const doubtful = t.kind === "neutral" && /var\(|revert/.test(text ?? "") && this.covered(part, axisOf(prop));
      if (verdict || doubtful) out.push({ prop, declared: text ?? decl.value, trace: t, verdict });
    }
    return out;
  }

  private covered(part: string | null, prop: string): boolean {
    return judge(this.policy.bundle.contract, this.tokens, part, prop, { kind: "unresolved", reason: "" }) !== null;
  }

  /** Matched rules come lowest priority first, with layers and specificity already applied by the browser. */
  private decls(rules: RuleMatch[], inline?: CssStyle): Decl[] {
    const out: Decl[] = [];
    const add = (style: CssStyle, trusted: boolean): void => {
      for (const p of style.cssProperties) {
        if (p.text === undefined || p.disabled || p.parsedOk === false) continue;
        out.push({ prop: p.name, value: p.value, important: p.important ?? /!important/i.test(p.text), trusted });
      }
    };
    for (const { rule } of rules) {
      if (rule.origin !== "regular") continue;
      add(rule.style, this.sheets.get(rule.styleSheetId ?? "") === `${ORIGIN}/ds.css`);
    }
    if (inline) add(inline, false);
    return out;
  }

  /**
   * Give every token a value of its own, all at once, and read each element again.
   * The trace proposes an answer; what moved decides. An answer the probe contradicts is replaced or becomes unresolved.
   */
  private async confirm(list: Candidate[], theme: string): Promise<void> {
    const tokens = this.policy.bundle.tokens;
    const asks = list.map((d) => ({ el: d.el, prop: d.computedProp, state: d.state, declared: d.declared }));
    const matches = await this.eval<boolean[]>(`__c.valueMatches(${JSON.stringify(asks)}, ${JSON.stringify(tokens.map((t) => ({ type: t.type, value: t.values[theme]! })))})`);
    list.forEach((d, i) => { d.valueMatch = matches[i] ?? false; });
    const sent = tokens.map((t, i) => ({ cssVar: t.cssVar, type: t.type, value: sentinel(t.type, i) }));
    const probe = await this.eval<Array<{ after: string; moved: boolean; token: number; ratio: number | null }>>(`__c.probe(${JSON.stringify(sent)}, ${JSON.stringify(asks)})`);
    list.forEach((d, i) => {
      // Forced states are gone by now, and a missing declaration has nothing to probe.
      if (d.state !== "rest" || d.declared === "(not declared)") return;
      const p = probe[i]!;
      const next = settle(d.trace, d.declared, p.after, p.moved, p.token < 0 ? null : tokens[p.token]!.name, (name) => this.ratioOf(name, sent, p.ratio));
      if (next === d.trace) return;
      d.trace = next;
      d.verdict = judge(this.policy.bundle.contract, this.tokens, d.part, d.prop, next);
    });
  }

  private ratioOf(name: string, sent: Array<{ cssVar: string; value: string }>, value: number | null): number | null {
    const s = sent.find((x) => x.cssVar === this.tokens.get(name)?.cssVar);
    const base = s ? Number.parseFloat(s.value) : Number.NaN;
    return value === null || !Number.isFinite(base) || base === 0 ? null : value / base;
  }

  /** Only the design system may set its own variables. */
  redefinedTokens(): Finding[] {
    const out: Finding[] = [];
    let root: postcss.Root;
    try {
      root = postcss.parse(this.screen.appCss);
    } catch {
      return out;
    }
    root.walkDecls((d) => {
      if (this.byVar.has(d.prop)) out.push(this.extraFinding("token-redefined", "stylesheet", d.prop, d.value, []));
    });
    return out;
  }

  async accessibility(theme: string): Promise<Finding[]> {
    const found = await this.eval<Array<{ id: string; path: string; cause: string | null }>>("__c.axe()");
    return found.map((f) => ({ ...this.extraFinding("accessibility", f.path, f.id, f.id, [theme]), ...(f.cause ? { cause: f.cause } : {}) }));
  }

  /** Inline overrides of token variables, and edits to the design system stylesheet made by script. */
  async tampering(): Promise<Finding[]> {
    const vars = [...this.byVar.keys()];
    const inline = await this.eval<Array<{ name: string; path: string }>>(`__c.inlineTokens(${JSON.stringify(vars)})`);
    const out = inline.map((f) => this.extraFinding("token-redefined", f.path, f.name, "inline", []));
    const id = [...this.sheets].find(([, url]) => url === `${ORIGIN}/ds.css`)?.[0];
    if (id) {
      const live = await this.eval<number>(`__c.countRules(${JSON.stringify(`${ORIGIN}/ds.css`)})`);
      const pristine = await this.eval<number>(`__c.countParsed(${JSON.stringify(this.screen.dsCss)})`);
      if (live !== pristine) out.push(this.extraFinding("token-redefined", "design-system", "stylesheet", "edited by script", []));
    } else out.push(this.extraFinding("token-redefined", "design-system", "stylesheet", "missing", []));
    return out;
  }

  private extraFinding(rule: string, p: string, prop: string, detail: string, themes: string[]): Finding {
    return { id: [rule, this.screen.id, p, prop, "rest", detail, 0].join("␟"), rule, screen: this.screen.id, path: p, prop, state: "rest", themes, blocking: true, detail };
  }
}

interface Judged { prop: string; declared: string; trace: Trace; verdict: Decision["verdict"] | null }
type Candidate = Omit<Decision, "verdict"> & { verdict: Decision["verdict"] | null; el: number; computedProp: string; repeat: boolean };

/**
 * `@property` rules, with the value a variable starts from. Read from the stylesheet text because CDP leaves them out
 * of the matched styles for linked stylesheets.
 */
function registrations(css: string): Map<string, { initial?: string; inherits: boolean }> {
  const out = new Map<string, { initial?: string; inherits: boolean }>();
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return out;
  }
  root.walkAtRules("property", (r) => {
    const get = (n: string): string | undefined => {
      const d = r.nodes?.find((x) => x.type === "decl" && x.prop === n);
      return d?.type === "decl" ? d.value : undefined;
    };
    const initial = get("initial-value");
    out.set(r.params.trim(), { inherits: get("inherits") !== "false", ...(initial ? { initial } : {}) });
  });
  return out;
}

/** What the trace says, held against what the probe saw. */
export function settle(t: Trace, declared: string, computed: string, moved: boolean, token: string | null, ratio: (name: string) => number | null): Trace {
  // Font-relative literals move when a type token does. They are still literals.
  if (t.kind === "literal" && !declared.includes("var(") && /\d(?:r?em|ex|ch|r?lh)\b/.test(declared)) return t;
  // The probe's values are large, so they win or lose a comparison the real ones don't.
  if (t.kind === "unresolved" && /^(min|max|clamp)\(/.test(t.reason)) return t;
  if (token) {
    if (t.kind === "token" && t.token === token && t.factor === 1) return t;
    return { kind: "token", token, factor: 1 };
  }
  if (!moved) {
    if (t.kind === "literal" || t.kind === "neutral") return t;
    return isNeutral(declared) || isNeutral(computed) ? { kind: "neutral" } : { kind: "literal", value: declared };
  }
  if (t.kind === "token") {
    const r = ratio(t.token);
    return t.factor !== 1 && r !== null && Math.abs(r - t.factor) < 0.01 ? t : { kind: "unresolved", reason: `${t.token} is not what moved it` };
  }
  if (t.kind === "unresolved") return t;
  return { kind: "unresolved", reason: "moves with a token the trace did not find" };
}

function winner(decls: Decl[], name: string): Decl | undefined {
  let best: Decl | undefined;
  for (const d of decls) {
    if (d.prop !== name) continue;
    if (!best || d.important || !best.important) best = d;
  }
  return best;
}

/**
 * Left and right padding from one utility are one decision; sides that differ stay separate.
 * The same decision in a repeated list item or row is one decision too, however many rows there are.
 */
function fold(list: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return list.filter((d) => {
    if (d.verdict === null) return false;
    const key = [d.repeat ? d.path : d.el, d.prop, d.state, d.theme, d.declared, d.verdict].join("\u241f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const HELPERS = String.raw`
globalThis.__c = (() => {
  const LANDMARK = new Set(["MAIN","NAV","HEADER","FOOTER","SECTION","ASIDE","FORM","TABLE","DIALOG","UL","OL"]);
  const c = { els: [], parts: [] };
  const partOf = (el) => { for (const p of c.parts) if (el.matches(p.selector)) return p.part; return null; };
  const segment = (el) => {
    const id = el.getAttribute("data-testid");
    const part = partOf(el);
    if (part) return id ? part + "#" + id : part;
    if (id) return el.tagName.toLowerCase() + "#" + id;
    return LANDMARK.has(el.tagName) ? el.tagName.toLowerCase() : null;
  };
  const pathOf = (el) => {
    const out = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.id === "root") break;
      const s = segment(e);
      if (s) out.unshift(s);
      else if (e === el) out.unshift(e.tagName.toLowerCase());
    }
    return out.join(">");
  };
  const shape = (el) => el.tagName + "." + el.className + "#" + (el.getAttribute("style") || "") + "@" + (el.getAttribute("data-testid") || "") + "[" + [...el.children].map(shape).join(",") + "]";
  const twins = (el) => (el.tagName === "TR" || el.tagName === "LI") && el.parentElement ? [...el.parentElement.children].filter((s) => s !== el && s.tagName === el.tagName && shape(s) === shape(el)).length > 0 : false;
  const flowOf = (el) => {
    const s = getComputedStyle(el); const m = s.writingMode;
    return { vertical: m !== "horizontal-tb", blockReversed: m === "vertical-rl" || m === "sideways-rl", inlineReversed: (s.direction === "rtl") !== (m === "sideways-lr") };
  };
  c.collect = (parts) => {
    c.parts = parts; c.els = []; const again = [];
    const walk = (el, inside) => {
      const r = inside || twins(el);
      c.els.push(el); again.push(r);
      for (const k of el.children) if (!(k instanceof SVGElement)) walk(k, r);
    };
    for (const k of document.body.children) {
      if (k.tagName === "SCRIPT" || k.tagName === "STYLE") continue;
      if (k.id === "root") for (const r of k.children) walk(r, false); else walk(k, false);
    }
    return c.els.map((el, i) => ({ part: partOf(el), path: pathOf(el), repeat: again[i], flow: flowOf(el) }));
  };
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const g = cv.getContext("2d", { willReadFrequently: true });
  const pixel = (v) => { g.clearRect(0,0,1,1); g.fillStyle = "#000"; g.fillStyle = v; g.fillRect(0,0,1,1); return [...g.getImageData(0,0,1,1).data].join(","); };
  const norm = (prop, v) => {
    if (/color$/.test(prop)) return "c" + pixel(v);
    if (/^-?[\d.]+px$/.test(v)) return "d" + Math.round(parseFloat(v) * 100);
    if (prop === "font-weight") return "w" + v;
    if (prop === "box-shadow") return "s" + (v.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px$/.test(x)).join(", ") || "none");
    return "s" + v.replace(/\s+/g, " ");
  };
  c.valueMatches = (asks, tokens) => {
    const box = document.createElement("div"); document.body.append(box);
    const set = new Set();
    for (const t of tokens) {
      if (t.type === "color") set.add("c" + pixel(t.value));
      else if (t.type === "dimension") set.add("d" + Math.round(parseFloat(t.value) * 100));
      else if (t.type === "fontWeight") set.add("w" + t.value);
      else if (t.type === "shadow") { box.style.boxShadow = t.value; set.add("s" + getComputedStyle(box).boxShadow.replace(/\s+/g, " ")); }
    }
    box.remove();
    return asks.map((a) => {
      const el = c.els[a.el];
      if (a.state === "rest") return set.has(norm(a.prop, getComputedStyle(el).getPropertyValue(a.prop)));
      const was = el.getAttribute("style");
      el.style.setProperty("transition", "none", "important");
      el.style.setProperty(a.prop === "border-top-color" ? "border-color" : a.prop, a.declared, "important");
      const v = norm(a.prop, getComputedStyle(el).getPropertyValue(a.prop));
      if (was === null) el.removeAttribute("style"); else el.setAttribute("style", was);
      return set.has(v);
    });
  };
  const SHOW = { color: "color", dimension: "width", number: "opacity", fontWeight: "font-weight", shadow: "box-shadow" };
  // Computed, not used, values: layout can't move them. Colours and shadows read the same either way.
  const read = (el, prop) => {
    let v;
    try { const x = el.computedStyleMap().get(prop); v = x ? x.toString() : ""; } catch { v = ""; }
    if (!v || prop === "box-shadow" || /color$/.test(prop)) v = getComputedStyle(el).getPropertyValue(prop);
    return v;
  };
  c.probe = (sent, asks) => {
    const still = document.createElement("style"); still.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}"; document.head.append(still);
    const before = asks.map((a) => read(c.els[a.el], a.prop));
    const st = document.createElement("style"); st.textContent = "*{" + sent.map((s) => s.cssVar + ":" + s.value + "!important").join(";") + "}"; document.head.append(st);
    const box = document.createElement("div"); document.body.append(box);
    const want = sent.map((s) => { box.style.cssText = SHOW[s.type] + ":" + s.value; const v = norm(SHOW[s.type] === "width" ? "height" : SHOW[s.type], getComputedStyle(box).getPropertyValue(SHOW[s.type])); return s.type + "|" + v; });
    box.remove();
    const typeOf = (prop) => (/color$/.test(prop) ? "color" : prop === "font-weight" ? "fontWeight" : prop === "box-shadow" ? "shadow" : "dimension");
    const out = asks.map((a, i) => {
      const after = read(c.els[a.el], a.prop);
      const n = norm(a.prop, after);
      return { after, moved: n !== norm(a.prop, before[i]), token: want.indexOf(typeOf(a.prop) + "|" + n), ratio: /^-?[\d.]+px$/.test(after) ? parseFloat(after) : null };
    });
    st.remove(); still.remove();
    return out;
  };
  c.inlineTokens = (vars) => {
    const out = [];
    for (const el of document.querySelectorAll("[style]")) for (const v of vars) if (el.style.getPropertyValue(v)) out.push({ name: v, path: pathOf(el) || el.tagName.toLowerCase() });
    return out;
  };
  const count = (rules) => { let n = 0; for (const r of rules) { n++; if (r.cssRules) n += count(r.cssRules); if (r.style) n += r.style.length; } return n; };
  c.countRules = (url) => { for (const s of document.styleSheets) if (s.href === url) return s.disabled ? -1 : count(s.cssRules); return -1; };
  c.countParsed = (text) => { const s = new CSSStyleSheet(); s.replaceSync(text); return count(s.cssRules); };
  c.axe = async () => {
    const r = await globalThis.axe.run(document.body, { resultTypes: ["violations"], rules: { region: { enabled: false }, "page-has-heading-one": { enabled: false }, "landmark-one-main": { enabled: false } } });
    const out = [];
    for (const v of r.violations) {
      if (v.impact !== "serious" && v.impact !== "critical") continue;
      for (const n of v.nodes) { const el = document.querySelector(n.target[0]); const bg = v.id === "color-contrast" ? n.any[0]?.relatedNodes?.[0]?.target?.[0] : null; const bgEl = bg ? document.querySelector(bg) : null;
        out.push({ id: v.id, path: el ? pathOf(el) : "body", cause: bgEl && bgEl !== el ? pathOf(bgEl) : null }); }
    }
    return out;
  };
  return c;
})(); true`;
