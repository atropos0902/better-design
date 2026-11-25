/** Split on a separator that is outside parentheses and quotes. */
export function splitTop(text: string, sep: "," | " " | "/"): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of text) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    const isSep = sep === " " ? /\s/.test(ch) : ch === sep;
    if (depth === 0 && isSep) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** `name(args)` when the whole text is one function call. */
export function asCall(text: string): { name: string; args: string } | null {
  const m = /^(-?[a-zA-Z][\w-]*)\(/.exec(text);
  if (!m || !text.endsWith(")")) return null;
  let depth = 0;
  for (let i = m[1]!.length; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") depth--;
    if (depth === 0 && i < text.length - 1) return null;
  }
  return depth === 0 ? { name: m[1]!.toLowerCase(), args: text.slice(m[1]!.length + 1, -1) } : null;
}

const NEUTRAL = new Set([
  "inherit", "initial", "unset", "revert", "revert-layer", "currentcolor", "transparent", "auto", "none",
  "normal", "fit-content", "min-content", "max-content", "stretch", "bolder", "lighter", "smaller", "larger",
  "#0000", "#00000000", "0 0 #0000", "0 0 0 0 #0000", "rgba(0, 0, 0, 0)",
]);

/** Values that take no position on the design system: resets, keywords, zero and percentages. */
export function isNeutral(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (NEUTRAL.has(t)) return true;
  if (/^[-+]?0*\.?0+(?:[a-z]+)?$/.test(t)) return true;
  return /^[-+]?[\d.]+(?:%|vh|vw|dvh|svh|fr)$/.test(t);
}

export const stripImportant = (text: string): string => text.replace(/\s*!important\s*$/i, "").trim();

const SIDES = ["top", "right", "bottom", "left"] as const;

export interface Flow { vertical: boolean; blockReversed: boolean; inlineReversed: boolean }
const LTR: Flow = { vertical: false, blockReversed: false, inlineReversed: false };

/** Where a logical side ends up for a writing mode and direction. */
export function physicalSide(logical: string, f: Flow = LTR): string {
  const [axis, end] = logical.split("-") as [string, string];
  const inline = f.vertical ? ["top", "bottom"] : ["left", "right"];
  const block = f.vertical ? ["left", "right"] : ["top", "bottom"];
  const [pair, reversed] = axis === "inline" ? [inline, f.inlineReversed] : [block, f.blockReversed];
  return pair[(end === "end") !== reversed ? 1 : 0]!;
}

/** Which canonical properties a declaration sets, with the text for each. null means "set, but not splittable". */
export function expand(prop: string, rawValue: string, flow: Flow = LTR): Array<[string, string | null]> {
  const value = stripImportant(rawValue);
  const p = prop.toLowerCase().replace(/^grid-((?:row-|column-)?gap)$/, "$1");
  const box = /^(padding|margin)(?:-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$/.exec(p);
  if (box) {
    const base = box[1]!;
    const parts = splitTop(value, " ");
    const sub = box[2];
    const put = (sides: readonly string[], texts: string[]): Array<[string, string | null]> =>
      sides.map((s, i) => [`${base}-${s}`, texts[i] ?? null]);
    if (!sub) {
      if (parts.length > 4) return put(SIDES, []);
      const [t, r = t, b = t, l = r] = parts as [string, string?, string?, string?];
      return put(SIDES, [t, r!, b!, l!]);
    }
    const [a, b = a] = parts as [string, string?];
    if (sub === "inline" || sub === "block") return put([physicalSide(`${sub}-start`, flow), physicalSide(`${sub}-end`, flow)], [a, b!]);
    return [[`${base}-${sub.includes("-") ? physicalSide(sub, flow) : sub}`, value]];
  }
  switch (p) {
    case "height": case "block-size": return [["height", value]];
    case "min-height": case "min-block-size": return [["min-height", value]];
    case "gap": {
      const parts = splitTop(value, " ");
      return [["row-gap", parts[0] ?? null], ["column-gap", parts[1] ?? parts[0] ?? null]];
    }
    case "row-gap": case "column-gap": case "color": case "background-color": case "font-size": case "font-weight": case "box-shadow":
      return [[p, value]];
    case "background": {
      const parts = splitTop(value, " ");
      if (parts.length === 1 && !/^(url|linear-gradient|radial-gradient|conic-gradient)\(/.test(parts[0]!)) return [["background-color", parts[0]!]];
      return [["background-color", /gradient\(|url\(/.test(value) ? null : (parts.find((x) => /^(var|#|rgb|hsl|oklch|color)/.test(x)) ?? null)]];
    }
    case "border-color": {
      const parts = splitTop(value, " ");
      return [["border-color", parts.length === 1 ? parts[0]! : null]];
    }
    case "border-top-color": return [["border-color", value]];
    case "border-block-start-color": case "border-block-end-color": case "border-inline-start-color": case "border-inline-end-color":
      return physicalSide(p.slice(7, -6), flow) === "top" ? [["border-color", value]] : [];
    case "border": case "border-top": {
      const parts = splitTop(value, " ");
      const color = parts.find((x) => !isLength(x) && !/^(solid|dashed|dotted|double|none|hidden|groove|ridge|inset|outset)$/.test(x) && !/^(thin|medium|thick)$/.test(x));
      const vars = parts.filter((x) => x.startsWith("var("));
      if (vars.length > 1) return [["border-color", null]];
      return color ? [["border-color", color]] : [["border-color", "currentcolor"]];
    }
    case "border-radius": {
      if (splitTop(value, "/").length > 1) return [["border-radius", null]];
      const parts = splitTop(value, " ");
      return [["border-radius", new Set(parts).size === 1 ? parts[0]! : null]];
    }
    case "border-top-left-radius": return [["border-radius", value]];
    case "border-start-start-radius": case "border-start-end-radius": case "border-end-start-radius": case "border-end-end-radius": {
      const [, block, inline] = /^border-(start|end)-(start|end)-radius$/.exec(p)!;
      const corner = new Set([physicalSide(`block-${block}`, flow), physicalSide(`inline-${inline}`, flow)]);
      return corner.has("top") && corner.has("left") ? [["border-radius", value]] : [];
    }
    case "font": {
      const keyword = /^(inherit|initial|unset|revert|revert-layer)$/i.test(value) ? value : null;
      return [["font-size", keyword], ["font-weight", keyword]];
    }
    default: return [];
  }
}

const isLength = (x: string): boolean => /^[-+]?[\d.]+[a-z]*$/i.test(x);

/** CSS computed property to read for a canonical property. */
export const COMPUTED: Record<string, string> = {
  "border-color": "border-top-color",
  "border-radius": "border-top-left-radius",
};

/** Four sides fold into two axes so one utility counts as one decision. */
export function axisOf(prop: string): string {
  return prop
    .replace(/^(padding|margin)-(left|right)$/, "$1-inline")
    .replace(/^(padding|margin)-(top|bottom)$/, "$1-block")
    .replace(/^(row|column)-gap$/, "gap");
}
