// Usage: node src/analyze.ts results/experiment.jsonl
import { readFile } from "node:fs/promises";
import { pairedBootstrap } from "@conform/core";
import type { Row } from "./run.ts";

export function analyze(rows: Row[]) {
  const tasks = [...new Set(rows.map((r) => r.task))].sort();
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const side = (t: string, server: boolean): Row[] => rows.filter((r) => r.task === t && r.server === server);
  const usable = tasks.filter((t) => side(t, true).length && side(t, false).length);
  const rate = (server: boolean): number => mean(rows.filter((r) => r.server === server).map((r) => Number(r.functional)));
  return {
    runs: rows.length,
    agents: [...new Set(rows.map((r) => `${r.agent} ${r.version}`))],
    binding: pairedBootstrap(usable.map((t) => mean(side(t, true).map((r) => r.binding)) - mean(side(t, false).map((r) => r.binding)))),
    functionalWith: rate(true),
    functionalWithout: rate(false),
  };
}

if (process.argv[1] === import.meta.filename) {
  const rows = (await readFile(process.argv[2]!, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
  console.log(JSON.stringify(analyze(rows), null, 2));
}
