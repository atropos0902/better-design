import { conclude, keyedHash, type Finding, type Stage } from "@conform/core";
import type { Review } from "./review.ts";

export interface GateAnswer { stage: Stage; killSwitch: boolean }

/** Everything the service is ever told. Rule ids, keyed hashes and counts. */
export async function wireReport(review: Review, pr: number, headSha: string, key: string, waivers: Array<{ rule: string; prop: string; count: number }>) {
  const s = review.score;
  return {
    pr, headSha,
    decisions: s.decisions, bound: s.bound, valueMatches: s.valueMatches, unresolved: s.unresolved, ms: Math.round(review.ms),
    findings: await Promise.all(review.fresh.map(async (f) => ({ rule: f.rule, hash: await keyedHash(key, f.id), blocking: f.blocking }))),
    waivers,
  };
}

export class Service {
  private readonly url: string;
  private readonly token: string;
  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }

  /** null means unreachable. The caller drops to comments; it never waits on an outage. */
  async gate(timeoutMs = 5000): Promise<GateAnswer | null> {
    try {
      const r = await fetch(`${this.url}/v1/gate`, { headers: { authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(timeoutMs) });
      return r.ok ? ((await r.json()) as GateAnswer) : null;
    } catch {
      return null;
    }
  }

  async report(body: unknown, timeoutMs = 10_000): Promise<{ conclusion: string; stage: Stage } | null> {
    try {
      const r = await fetch(`${this.url}/v1/reports`, { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
      return r.ok ? ((await r.json()) as { conclusion: string; stage: Stage }) : null;
    } catch {
      return null;
    }
  }
}

const FIX: Record<string, (f: Finding) => string> = {
  "literal-value": (f) => (f.detail === "(not declared)" ? `\`${f.prop}\` is missing` : `\`${f.prop}: ${f.detail}\` isn't a design system value`),
  "wrong-token": (f) => `\`${f.prop}\` uses a token this part doesn't allow (\`${f.detail}\`)`,
  "derived-token": (f) => `\`${f.prop}\` scales a token (\`${f.detail}\`)`,
  "token-redefined": (f) => `\`${f.prop}\` belongs to the design system and can't be set here`,
  accessibility: (f) => `axe: ${f.prop}`,
  unresolved: (f) => `\`${f.prop}: ${f.detail}\` couldn't be traced to a token`,
};

const clean = (s: string): string => s.replace(/[`|\r\n<>@]/g, " ").slice(0, 160);

/** The pull request comment. Written from the runner, with the runner's own token. */
export function comment(review: Review, stage: Stage): string {
  const pct = (n: number): string => `${Math.round(n * 100)}%`;
  const lines = [
    "<!-- conform -->",
    `**Design system review:** binding ${pct(review.score.binding)}, value ${pct(review.score.value)}, ${review.score.decisions} style decisions in this change.`,
    "",
  ];
  const groups: Array<[string, Finding[]]> = [
    [stage === "required" ? "Fix before merging" : "Worth fixing", review.fresh.filter((f) => f.blocking)],
    ["For a person to look at", review.fresh.filter((f) => !f.blocking)],
  ];
  for (const [title, list] of groups) {
    if (!list.length) continue;
    lines.push(`${title}:`, "");
    for (const f of list.slice(0, 30)) {
      const safe = { ...f, detail: clean(f.detail), prop: clean(f.prop) };
      const where = f.themes.length && f.themes.length < 4 ? ` (${f.themes.join(", ")})` : "";
      lines.push(`- \`${clean(f.screen)}\` \`${clean(f.path.split(">").slice(-2).join(" / "))}\`${f.state === "rest" ? "" : ` on ${f.state}`}: ${FIX[f.rule]?.(safe) ?? f.rule}${where}`);
    }
    if (list.length > 30) lines.push(`- and ${list.length - 30} more`);
    lines.push("");
  }
  if (!review.fresh.length) lines.push("Nothing new to fix.", "");
  for (const q of review.questions) lines.push(`Question for the design system team: ${q.rule} on ${q.prop} has been waived ${q.count} times. The rule may be the mistake.`);
  return `${lines.join("\n").trimEnd()}\n`;
}

/** Local conclusion, used when there is no service to ask. */
export const offline = (fresh: Finding[]): ReturnType<typeof conclude> => conclude({ stage: "comments", killSwitch: false, reachable: false }, fresh);
