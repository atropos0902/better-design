import type { Decision } from "./judge.ts";

export interface Score {
  decisions: number;
  bound: number;
  unresolved: number;
  valueMatches: number;
  binding: number;
  value: number;
}

/** A decision is bound only if it is bound in every theme it was rendered in. */
export function score(decisions: Decision[]): Score {
  const groups = new Map<string, Decision[]>();
  const seen = new Map<string, number>();
  for (const d of decisions) {
    const place = [d.screen, d.path, d.prop, d.state].join("␟");
    const nth = `${place}␟${d.theme}`;
    const n = seen.get(nth) ?? 0;
    seen.set(nth, n + 1);
    const key = `${place}␟${n}`;
    const g = groups.get(key);
    if (g) g.push(d);
    else groups.set(key, [d]);
  }
  let bound = 0;
  let unresolved = 0;
  let valueMatches = 0;
  for (const g of groups.values()) {
    if (g.every((d) => d.verdict === "bound")) bound++;
    if (g.some((d) => d.verdict === "unresolved")) unresolved++;
    if (g[0]!.valueMatch) valueMatches++;
  }
  const n = groups.size;
  return { decisions: n, bound, unresolved, valueMatches, binding: n ? bound / n : 1, value: n ? valueMatches / n : 1 };
}

/** Decisions in head that base did not have, so a pull request is scored on its own work. */
export function addedDecisions(base: Decision[], head: Decision[]): Decision[] {
  const key = (d: Decision): string => [d.screen, d.path, d.prop, d.state, d.theme, d.declared].join("␟");
  const left = new Map<string, number>();
  for (const d of base) left.set(key(d), (left.get(key(d)) ?? 0) + 1);
  return head.filter((d) => {
    const n = left.get(key(d)) ?? 0;
    if (n > 0) left.set(key(d), n - 1);
    return n === 0;
  });
}

export interface PairedResult { mean: number; low: number; high: number; tasks: number }

/** Mean per-task difference with a percentile bootstrap over tasks. Seeded, so a rerun prints the same interval. */
export function pairedBootstrap(diffs: number[], rounds = 10_000, seed = 7): PairedResult {
  if (diffs.length === 0) throw new Error("no tasks to compare");
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const means: number[] = [];
  for (let r = 0; r < rounds; r++) {
    let sum = 0;
    for (let i = 0; i < diffs.length; i++) sum += diffs[Math.floor(rand() * diffs.length)]!;
    means.push(sum / diffs.length);
  }
  means.sort((a, b) => a - b);
  return { mean: mean(diffs), low: means[Math.floor(rounds * 0.025)]!, high: means[Math.ceil(rounds * 0.975) - 1]!, tasks: diffs.length };
}
