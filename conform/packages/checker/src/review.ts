import { chromium, type Browser } from "playwright-core";
import {
  addedDecisions, isWaived, newFindings, openQuestions, score, settleCauses, toFindings,
  type Decision, type Finding, type Score,
} from "@conform/core";
import { buildScreen } from "./build.ts";
import { loadPolicy, screensToReview, withHeadCss, type Policy } from "./config.ts";
import { inspectScreen, type Inspection } from "./inspect.ts";

export interface Review {
  repo: string;
  changedScreens: string[];
  findings: Finding[];
  fresh: Finding[];
  waived: Finding[];
  questions: Array<{ rule: string; prop: string; count: number }>;
  score: Score;
  decisions: Decision[];
  blockedRequests: number;
  ms: number;
}

export async function launch(): Promise<Browser> {
  return chromium.launch(process.env["CONFORM_CHROMIUM"] ? { executablePath: process.env["CONFORM_CHROMIUM"] } : {});
}

/** axe sees the same element once per theme; the paths can also repeat across list items. */
const all = (i: Inspection): Finding[] => [...toFindings(i.decisions), ...i.extra];

/** Review head against base. Only screens whose built inputs changed are opened. */
export async function reviewPullRequest(browser: Browser, baseDir: string, headDir: string, concurrency = 3): Promise<Review> {
  const started = performance.now();
  const policy = await loadPolicy(baseDir);
  const screens = await screensToReview(policy, headDir);
  const headPolicy = await withHeadCss(policy, headDir);
  const results = await pool(screens, concurrency, async (s) => {
    const before = policy.config.screens.find((b) => b.id === s.id);
    const [base, head] = await Promise.all([before ? buildScreen(policy, baseDir, before) : null, buildScreen(headPolicy, headDir, s)]);
    if (!head || base?.inputs === head.inputs) return null;
    const h = await inspectScreen(browser, policy, head);
    const b = base ? await inspectScreen(browser, policy, base).catch(() => null) : null;
    return { id: s.id, head: h, base: b };
  });
  const changed = results.filter((r) => r !== null);
  const findings = changed.flatMap((r) => all(r.head));
  // What base already shows is old, and so is whatever the stored baseline accepted.
  const known = new Set([...policy.baseline, ...changed.flatMap((r) => (r.base ? all(r.base).map((f) => f.id) : []))]);
  const unknown = settleCauses(newFindings(findings, known), known);
  const added = changed.flatMap((r) => addedDecisions(r.base?.decisions ?? [], r.head.decisions));
  return {
    repo: policy.config.repo,
    changedScreens: changed.map((r) => r.id),
    findings,
    fresh: unknown.filter((f) => !isWaived(f, policy.waivers)),
    waived: unknown.filter((f) => isWaived(f, policy.waivers)),
    questions: openQuestions(policy.waivers),
    score: score(added),
    decisions: added,
    blockedRequests: changed.reduce((n, r) => n + r.head.blockedRequests, 0),
    ms: performance.now() - started,
  };
}

/** Everything in a repository today. Used for the first baseline and for the before number. */
export async function surveyRepo(browser: Browser, dir: string): Promise<{ policy: Policy; findings: Finding[]; decisions: Decision[]; score: Score }> {
  const policy = await loadPolicy(dir);
  const results = await pool(policy.config.screens, 3, async (s) => {
    const built = await buildScreen(policy, dir, s);
    if (!built) throw new Error(`screen ${s.id}: ${s.module} not found`);
    return inspectScreen(browser, policy, built);
  });
  const decisions = results.flatMap((r) => r.decisions);
  return { policy, findings: results.flatMap(all), decisions, score: score(decisions) };
}

export async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }));
  return out;
}
