import { asCall, isNeutral, splitTop, stripImportant } from "./cssvalue.ts";

export type Trace =
  | { kind: "token"; token: string; factor: number }
  | { kind: "literal"; value: string }
  | { kind: "neutral" }
  | { kind: "unresolved"; reason: string };

export interface Scope<S> {
  /** The declaration that sets a custom property, seen from `at`, and the scope it was declared in. */
  lookup(name: string, at: S): { value: string; at: S } | undefined;
  /** Token name for a custom property, if it is one of the design system's. */
  token(cssVar: string): string | undefined;
}

const MAX_DEPTH = 16;

/** Follow a declared value back to a design token, a literal, or an honest "don't know". */
export function trace<S>(text: string, at: S, scope: Scope<S>, depth = 0): Trace {
  const value = stripImportant(text);
  if (depth > MAX_DEPTH) return { kind: "unresolved", reason: "variable cycle" };
  if (value === "") return { kind: "unresolved", reason: "empty value" };
  if (isNeutral(value)) return { kind: "neutral" };

  const call = asCall(value);
  if (call?.name === "var") return traceVar(call.args, at, scope, depth);
  if (call?.name === "calc") return traceCalc(call.args, at, scope, depth);
  if (call?.name === "light-dark") {
    const arms = splitTop(call.args, ",").map((a) => trace(a, at, scope, depth + 1));
    return agree(arms, value);
  }
  if (!value.includes("var(")) return { kind: "literal", value };

  const layers = splitTop(value, ",");
  if (layers.length > 1) {
    const live = layers.map((l) => trace(l, at, scope, depth + 1)).filter((t) => t.kind !== "neutral");
    if (live.length === 0) return { kind: "neutral" };
    if (live.length === 1) return live[0]!;
  }
  if (onlyLiterals(value, at, scope, depth)) return { kind: "literal", value };
  return { kind: "unresolved", reason: call ? `${call.name}() mixes values` : "value mixes tokens and literals" };
}

/** Every variable in the value leads to a literal, so no token is behind any of it. */
function onlyLiterals<S>(text: string, at: S, scope: Scope<S>, depth: number): boolean {
  const refs: string[] = [];
  for (let i = text.indexOf("var("); i >= 0; i = text.indexOf("var(", i + 1)) {
    let end = i + 3;
    let open = 0;
    do {
      if (text[end] === "(") open++;
      if (text[end] === ")") open--;
      end++;
    } while (open > 0 && end < text.length);
    refs.push(text.slice(i, end));
    i = end;
  }
  return refs.length > 0 && refs.every((r) => {
    const t = trace(r, at, scope, depth + 1);
    return t.kind === "literal" || t.kind === "neutral";
  });
}

function traceVar<S>(args: string, at: S, scope: Scope<S>, depth: number): Trace {
  const comma = args.indexOf(",");
  const name = (comma < 0 ? args : args.slice(0, comma)).trim();
  const fallback = comma < 0 ? undefined : args.slice(comma + 1).trim();
  const found = scope.lookup(name, at);
  if (!found || found.value.trim() === "initial") {
    if (fallback === undefined) return { kind: "unresolved", reason: `${name} is not defined` };
    return fallback === "" ? { kind: "neutral" } : trace(fallback, at, scope, depth + 1);
  }
  const token = scope.token(name);
  if (token) return { kind: "token", token, factor: 1 };
  return trace(found.value, found.at, scope, depth + 1);
}

function traceCalc<S>(args: string, at: S, scope: Scope<S>, depth: number): Trace {
  if (!args.includes("var(")) return { kind: "literal", value: `calc(${args})` };
  const m =
    /^\s*(var\(.*\))\s*([*/])\s*([-+]?[\d.]+)\s*$/s.exec(args) ??
    flip(/^\s*([-+]?[\d.]+)\s*(\*)\s*(var\(.*\))\s*$/s.exec(args));
  if (!m || !asCall(m[1]!.trim())) {
    if (onlyLiterals(args, at, scope, depth)) return { kind: "literal", value: `calc(${args})` };
    return { kind: "unresolved", reason: "calc() mixes values" };
  }
  const inner = trace(m[1]!.trim(), at, scope, depth + 1);
  const n = Number(m[3]);
  if (!Number.isFinite(n) || n === 0) return n === 0 ? { kind: "neutral" } : { kind: "unresolved", reason: "calc() factor" };
  if (inner.kind === "token") return { ...inner, factor: m[2] === "*" ? inner.factor * n : inner.factor / n };
  if (inner.kind === "literal") return { kind: "literal", value: `calc(${args.trim()})` };
  return inner;
}

const flip = (m: RegExpExecArray | null): string[] | null => (m ? [m[0], m[3]!, m[2]!, m[1]!] : null);

function agree(arms: Trace[], value: string): Trace {
  const [first] = arms;
  if (!first) return { kind: "unresolved", reason: "empty light-dark()" };
  if (arms.every((a) => a.kind === "token" && first.kind === "token" && a.token === first.token && a.factor === first.factor)) return first;
  if (arms.every((a) => a.kind === "neutral")) return first;
  if (arms.every((a) => a.kind === "literal")) return { kind: "literal", value };
  return { kind: "unresolved", reason: "light-dark() arms differ" };
}
