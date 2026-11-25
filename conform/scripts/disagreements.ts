// Compare the Figma variables export with the token package. Writes docs/discovery/token-disagreements.md
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { adapter } from "../customers/northgate/adapter.ts";

interface Figma { meta: { variableCollections: Record<string, { modes: Array<{ modeId: string; name: string }> }>; variables: Record<string, { name: string; valuesByMode: Record<string, number | { r: number; g: number; b: number }> }> } }
const dir = "customers/northgate/design-system";
const figma = JSON.parse(await readFile(`${dir}/figma-variables.json`, "utf8")) as Figma;
const { tokens, themes } = await adapter.load(dir);
const modes = Object.values(figma.meta.variableCollections).flatMap((c) => c.modes);
const hex = (c: { r: number; g: number; b: number }): string => `#${[c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
const rows: string[] = [];
const seen = new Set<string>();
for (const v of Object.values(figma.meta.variables)) {
  const name = v.name.replace("/", ".");
  seen.add(name);
  const t = tokens.find((x) => x.name === name);
  if (!t) {
    rows.push(`| ${name} | all | ${typeof Object.values(v.valuesByMode)[0] === "number" ? "number" : hex(Object.values(v.valuesByMode)[0] as never)} | not in the package |`);
    continue;
  }
  for (const m of modes) {
    const f = v.valuesByMode[m.modeId]!;
    const value = typeof f === "number" ? `${f}px` : hex(f);
    if (value !== t.values[m.name]) rows.push(`| ${name} | ${m.name} | ${value} | ${t.values[m.name]} |`);
  }
}
const missing = tokens.filter((t) => !seen.has(t.name)).length;
await mkdir("docs/discovery", { recursive: true });
await writeFile("docs/discovery/token-disagreements.md", `# Tokens where Figma and the package disagree

Made by \`node scripts/disagreements.ts\`. Don't edit by hand.

| Token | Theme | Figma | Package |
| --- | --- | --- | --- |
${rows.join("\n")}

The Figma export has ${seen.size} variables and ${modes.length} modes. The package has ${tokens.length} tokens and ${themes.length} themes, so ${missing} tokens and the dark themes have no Figma side to compare.
`);
console.log(rows.length, "disagreements");
