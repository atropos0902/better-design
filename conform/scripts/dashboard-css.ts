// The dashboard's copy of the design system stylesheet, generated from its signed bundle.
import { writeFile } from "node:fs/promises";
import { designSystemCss, loadPolicy } from "../packages/checker/src/index.ts";
const policy = await loadPolicy("packages/dashboard");
const css = await designSystemCss(policy.bundle, "css-modules");
await writeFile("packages/dashboard/app/ds.css", css.slice(css.indexOf(":root,")) + `\nbody{${Object.entries(policy.bundle.contract.root ?? {}).map(([p, n]) => `${p}:var(${policy.bundle.tokens.find((t) => t.name === n)!.cssVar})`).join(";")}}\n`);
