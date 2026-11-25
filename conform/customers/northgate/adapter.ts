import { readFile } from "node:fs/promises";
import path from "node:path";
import { cssVarFor, type Token, type TokenAdapter, type TokenType } from "../../packages/core/src/index.ts";

type Node = { [k: string]: unknown };
interface Raw { type: TokenType; value: unknown; description?: string }

/** Design Tokens Format Module files, one per set. Later sets override earlier ones. */
export const adapter: TokenAdapter = {
  async load(dir) {
    const themes = JSON.parse(await readFile(path.join(dir, "themes.json"), "utf8")) as Record<string, string[]>;
    const tokens = new Map<string, Token>();
    for (const [theme, sets] of Object.entries(themes)) {
      const raw = new Map<string, Raw>();
      for (const s of sets) collect(JSON.parse(await readFile(path.join(dir, "tokens", `${s}.tokens.json`), "utf8")) as Node, [], undefined, raw);
      for (const [name, r] of raw) {
        // Primitives are not for use in a screen, so they get no variable and can't be bound to.
        if (name.startsWith("palette.")) continue;
        const t = tokens.get(name) ?? { name, type: r.type, cssVar: cssVarFor("ng", name), values: {}, ...(r.description ? { description: r.description } : {}) };
        t.values[theme] = css(r, raw, 0);
        tokens.set(name, t);
      }
    }
    return { themes: Object.keys(themes), tokens: [...tokens.values()] };
  },
};

function collect(node: Node, at: string[], inherited: TokenType | undefined, out: Map<string, Raw>): void {
  const type = (node["$type"] as TokenType | undefined) ?? inherited;
  if ("$value" in node) {
    if (!type) throw new Error(`${at.join(".")} has no $type`);
    const description = node["$description"] as string | undefined;
    out.set(at.join("."), { type, value: node["$value"], ...(description ? { description } : {}) });
    return;
  }
  for (const [k, v] of Object.entries(node)) if (!k.startsWith("$") && v && typeof v === "object") collect(v as Node, [...at, k], type, out);
}

function css(r: Raw, all: Map<string, Raw>, depth: number): string {
  if (depth > 10) throw new Error("token alias cycle");
  if (typeof r.value === "string" && /^\{.+\}$/.test(r.value)) {
    const target = all.get(r.value.slice(1, -1));
    if (!target) throw new Error(`unknown alias ${r.value}`);
    return css(target, all, depth + 1);
  }
  const v = r.value as Node;
  switch (r.type) {
    case "color": return color(v);
    case "dimension": return dim(v);
    case "shadow": return `${dim(v["offsetX"] as Node)} ${dim(v["offsetY"] as Node)} ${dim(v["blur"] as Node)} ${dim(v["spread"] as Node)} ${color(v["color"] as Node)}`;
    default: return String(r.value);
  }
}
const dim = (v: Node): string => `${v["value"] as number}${v["unit"] as string}`;
const color = (v: Node): string => {
  const alpha = v["alpha"] as number | undefined;
  return alpha === undefined ? (v["hex"] as string) : `${v["hex"] as string}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
};
