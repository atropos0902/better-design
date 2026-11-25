import { readFile } from "node:fs/promises";
import path from "node:path";
import { cssVarFor, type Token, type TokenAdapter, type TokenType } from "../../packages/core/src/index.ts";

/** Tokens Studio export: bare numbers, `{alias} * n` maths, one override file per brand. Brands are the themes. */
const TYPES: Record<string, TokenType> = { color: "color", spacing: "dimension", borderRadius: "dimension", fontSizes: "dimension", sizing: "dimension", fontWeights: "fontWeight" };
type Leaf = { value: string; type: string; comment?: string };
type Tree = { [k: string]: Tree | Leaf };

const walk = (t: Tree, at: string[], out: Map<string, Leaf>): Map<string, Leaf> => {
  for (const [k, v] of Object.entries(t)) {
    if (typeof (v as Leaf).value === "string") out.set([...at, k].join("."), v as Leaf);
    else walk(v as Tree, [...at, k], out);
  }
  return out;
};

function resolve(all: Map<string, Leaf>, name: string, depth = 0): string {
  const leaf = all.get(name);
  if (!leaf || depth > 10) throw new Error(`can't resolve ${name}`);
  const m = /^\{([^}]+)\}(?:\s*\*\s*([\d.]+))?$/.exec(leaf.value);
  if (!m) return leaf.value;
  const inner = resolve(all, m[1]!, depth + 1);
  return m[2] ? String(Number(inner) * Number(m[2])) : inner;
}

export const adapter: TokenAdapter = {
  async load(dir) {
    const read = async (f: string): Promise<Tree> => JSON.parse(await readFile(path.join(dir, "tokens", f), "utf8")) as Tree;
    const brands: Record<string, string[]> = { hillside: ["core.json"], orchard: ["core.json", "brand-orchard.json"] };
    const tokens = new Map<string, Token>();
    for (const [brand, files] of Object.entries(brands)) {
      const all = new Map<string, Leaf>();
      for (const f of files) walk(await read(f), [], all);
      for (const [name, leaf] of all) {
        // Raw colours and spacing steps are ingredients; screens use the semantic names.
        if (/^global\.(color|spacing)\./.test(name)) continue;
        const type = TYPES[leaf.type]!;
        const raw = resolve(all, name);
        const t = tokens.get(name) ?? { name, type, cssVar: cssVarFor("fh", name), values: {} };
        t.values[brand] = type === "dimension" ? `${raw}px` : raw;
        tokens.set(name, t);
      }
    }
    return { themes: Object.keys(brands), tokens: [...tokens.values()] };
  },
};
