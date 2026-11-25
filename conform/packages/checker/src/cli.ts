#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadPolicy } from "./config.ts";
import { launch, reviewPullRequest, surveyRepo } from "./review.ts";
import { comment, offline, Service, wireReport } from "./report.ts";

const USAGE = `conform-check review --base <dir> --head <dir> [--pr <n> --sha <commit> --out <file>]
conform-check survey --base <dir> [--write-baseline]

Environment for review: CONFORM_SERVICE_URL, CONFORM_TOKEN (runner OIDC token), CONFORM_HASH_KEY (stays on this runner),
GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_API_URL for the comment and for the fallback check.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string" }, head: { type: "string" }, pr: { type: "string" }, sha: { type: "string" }, out: { type: "string" },
    "write-baseline": { type: "boolean" }, help: { type: "boolean" },
  },
});
const need = (k: "base" | "head"): string => {
  const v = values[k];
  if (!v) throw new Error(`--${k} is required\n\n${USAGE}`);
  return path.resolve(v);
};

async function github(method: string, route: string, body?: unknown): Promise<unknown> {
  const { GITHUB_API_URL = "https://api.github.com", GITHUB_TOKEN } = process.env;
  const r = await fetch(`${GITHUB_API_URL}${route}`, { method, headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`GitHub ${method} ${route}: ${r.status}`);
  return r.json();
}

/** One comment per pull request, edited in place. */
async function postComment(repo: string, pr: number, text: string): Promise<void> {
  const list = (await github("GET", `/repos/${repo}/issues/${pr}/comments?per_page=100`)) as Array<{ id: number; body: string }>;
  const mine = list.find((c) => c.body.startsWith("<!-- conform -->"));
  if (mine) await github("PATCH", `/repos/${repo}/issues/comments/${mine.id}`, { body: text });
  else await github("POST", `/repos/${repo}/issues/${pr}/comments`, { body: text });
}

async function review(): Promise<number> {
  const base = need("base");
  const browser = await launch();
  try {
    const r = await reviewPullRequest(browser, base, need("head"));
    const policy = await loadPolicy(base);
    const counts = new Map<string, { rule: string; prop: string; count: number }>();
    for (const w of policy.waivers) {
      const k = `${w.rule}|${w.prop}`;
      counts.set(k, { rule: w.rule, prop: w.prop, count: (counts.get(k)?.count ?? 0) + 1 });
    }
    const { CONFORM_SERVICE_URL, CONFORM_TOKEN, CONFORM_HASH_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
    const pr = Number(values.pr);
    const service = CONFORM_SERVICE_URL && CONFORM_TOKEN ? new Service(CONFORM_SERVICE_URL, CONFORM_TOKEN) : null;
    let answer: { conclusion: string; stage: "silent" | "comments" | "required" } | null = null;
    if (service && values.sha && pr) {
      if (!CONFORM_HASH_KEY) throw new Error("CONFORM_HASH_KEY is required to report");
      if (await service.gate()) answer = await service.report(await wireReport(r, pr, values.sha, CONFORM_HASH_KEY, [...counts.values()]));
    }
    const result = answer ?? { conclusion: offline(r.fresh).conclusion, stage: "comments" as const };
    const text = comment(r, result.stage);
    if (values.out) await writeFile(values.out, text);
    if (GITHUB_TOKEN && GITHUB_REPOSITORY && pr && result.stage !== "silent") {
      if (r.fresh.length) await postComment(GITHUB_REPOSITORY, pr, text);
      // The service is down: put a neutral check in place of the one it can't finish, so no merge waits on it.
      if (!answer && values.sha) await github("POST", `/repos/${GITHUB_REPOSITORY}/check-runs`, { name: "conform", head_sha: values.sha, status: "completed", conclusion: "neutral", output: { title: "Comments only", summary: "The review service could not be reached." } });
    }
    console.log(JSON.stringify({ conclusion: result.conclusion, stage: result.stage, reported: answer !== null, screens: r.changedScreens, newFindings: r.fresh.length, blocking: r.fresh.filter((f) => f.blocking).length, binding: r.score.binding, value: r.score.value, ms: Math.round(r.ms) }));
    return 0;
  } finally {
    await browser.close();
  }
}

async function survey(): Promise<number> {
  const base = need("base");
  const browser = await launch();
  try {
    const s = await surveyRepo(browser, base);
    if (values["write-baseline"]) {
      await mkdir(path.join(base, ".conform"), { recursive: true });
      await writeFile(path.join(base, ".conform/baseline.json"), `${JSON.stringify(s.findings.map((f) => f.id).sort(), null, 1)}\n`);
    }
    console.log(JSON.stringify({ repo: s.policy.config.repo, ...s.score, findings: s.findings.length }));
    return 0;
  } finally {
    await browser.close();
  }
}

const commands: Record<string, () => Promise<number>> = { review, survey };
const run = commands[positionals[0] ?? ""];
if (!run || values.help) {
  console.error(USAGE);
  process.exit(values.help ? 0 : 2);
}
run().then((code) => process.exit(code), (e: Error) => {
  console.error(e.message);
  process.exit(1);
});
