import { isViolation, type Decision } from "./judge.ts";

export interface Finding {
  id: string;
  rule: string;
  screen: string;
  path: string;
  prop: string;
  state: string;
  themes: string[];
  /** Blocks a merge at the required stage. */
  blocking: boolean;
  /** Path of the element that caused it, when that is a different element. */
  cause?: string;
  /** For the pull request comment only. Never sent to the service. */
  detail: string;
}

/** rule + component + position in the tree + what was written. No file, no line. */
export const findingKey = (f: Pick<Finding, "rule" | "screen" | "path" | "prop" | "state" | "detail">): string =>
  [f.rule, f.screen, f.path, f.prop, f.state, f.detail].join("␟");

/** One finding per place, with the themes it happens in. Repeats of the same key get an index. */
export function toFindings(decisions: Decision[]): Finding[] {
  const perTheme = new Map<string, Map<string, number>>();
  for (const d of decisions) {
    if (d.verdict === "bound") continue;
    const base = { rule: d.verdict, screen: d.screen, path: d.path, prop: d.prop, state: d.state, detail: d.declared };
    const key = findingKey(base);
    const themes = perTheme.get(key) ?? new Map<string, number>();
    themes.set(d.theme, (themes.get(d.theme) ?? 0) + 1);
    perTheme.set(key, themes);
  }
  const out: Finding[] = [];
  for (const [key, themes] of perTheme) {
    const [rule, screen, path, prop, state, detail] = key.split("␟") as [string, string, string, string, string, string];
    const count = Math.max(...themes.values());
    for (let i = 0; i < count; i++) {
      out.push({
        id: `${key}␟${i}`, rule, screen, path, prop, state, detail,
        themes: [...themes].filter(([, n]) => n > i).map(([t]) => t).sort(),
        blocking: isViolation(rule as Decision["verdict"]),
      });
    }
  }
  return out;
}

/**
 * A new element on an old background can fail contrast without its author doing anything wrong.
 * If the cause is an old finding, the new one is a comment.
 */
export function settleCauses(fresh: Finding[], known: Iterable<string>): Finding[] {
  const oldBackgrounds = new Set<string>();
  for (const id of known) {
    const [, screen, path, prop] = id.split("\u241f") as [string, string, string, string];
    if (prop === "background-color") oldBackgrounds.add(`${screen}\u241f${path}`);
  }
  return fresh.map((f) => (f.cause && oldBackgrounds.has(`${f.screen}\u241f${f.cause}`) ? { ...f, blocking: false } : f));
}

/** Findings beyond what the baseline already holds. */
export function newFindings(head: Finding[], baseline: Iterable<string>): Finding[] {
  const known = new Set(baseline);
  return head.filter((f) => !known.has(f.id));
}

export interface Waiver {
  rule: string;
  screen: string;
  path: string;
  prop: string;
  owner: string;
  reason: string;
}

export function validateWaivers(list: unknown): Waiver[] {
  if (!Array.isArray(list)) throw new Error("waivers must be a list");
  return list.map((w, i) => {
    const r = w as Partial<Waiver>;
    for (const k of ["rule", "screen", "path", "prop", "owner", "reason"] as const) {
      if (typeof r[k] !== "string" || r[k].trim() === "") throw new Error(`waiver ${i}: ${k} is required`);
    }
    return r as Waiver;
  });
}

export const isWaived = (f: Finding, waivers: Waiver[]): boolean =>
  waivers.some((w) => w.rule === f.rule && w.screen === f.screen && w.path === f.path && w.prop === f.prop);

/** Three waivers of one rule and property mean the rule may be the mistake. */
export function openQuestions(waivers: Waiver[], limit = 3): Array<{ rule: string; prop: string; count: number }> {
  const counts = new Map<string, number>();
  for (const w of waivers) counts.set(`${w.rule}|${w.prop}`, (counts.get(`${w.rule}|${w.prop}`) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= limit).map(([k, count]) => {
    const [rule, prop] = k.split("|") as [string, string];
    return { rule, prop, count };
  });
}
