// Score every repository as it is today and write its baseline. Usage: node scripts/survey.ts <customer> [--write]
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { launch, surveyRepo } from "../packages/checker/src/index.ts";

const customer = process.argv[2] ?? "northgate";
const root = path.resolve("customers", customer, "repos");
const browser = await launch();
const rows: Array<Record<string, unknown>> = [];
for (const repo of (await readdir(root)).sort()) {
  const s = await surveyRepo(browser, path.join(root, repo));
  if (process.argv.includes("--write")) {
    await mkdir(path.join(root, repo, ".conform"), { recursive: true });
    await writeFile(path.join(root, repo, ".conform/baseline.json"), `${JSON.stringify(s.findings.map((f) => f.id).sort(), null, 1)}\n`);
  }
  const rules: Record<string, number> = {};
  for (const f of s.findings) rules[f.rule] = (rules[f.rule] ?? 0) + 1;
  rows.push({ repo, decisions: s.score.decisions, binding: +(s.score.binding * 100).toFixed(1), value: +(s.score.value * 100).toFixed(1), unresolved: s.score.unresolved, ...rules });
}
await browser.close();
console.table(rows);
if (process.argv.includes("--write")) {
  await mkdir("results", { recursive: true });
  await writeFile(`results/survey-${customer}.json`, `${JSON.stringify(rows, null, 2)}\n`);
}
