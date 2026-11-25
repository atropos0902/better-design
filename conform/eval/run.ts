// Score one half of the evaluation set. Usage: node eval/run.ts dev|heldout [--write]
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser } from "playwright-core";
import { isViolation, splitTop, type Finding, type Trace } from "../packages/core/src/index.ts";
import { designSystemCss, inspectScreen, launch, loadPolicy, pool, reviewPullRequest, type Policy } from "../packages/checker/src/index.ts";

interface Plant { screen: string; testid: string; prop: string; kind: string; state?: string; note?: string }
interface Pr { id: string; repo: string; title: string; body: string; files: Record<string, string | null>; plants: Plant[] }
interface TraceCase { id: string; css: string; html: string; prop: string; expect: { kind: "token" | "literal" | "neutral"; token?: string } }

const half = process.argv[2] ?? "dev";
const dir = path.resolve("eval", half);
const repos = path.resolve("customers/northgate/repos");

export async function materialize(repo: string, files: Record<string, string | null>): Promise<{ base: string; head: string; done: () => Promise<void> }> {
  const tmp = await mkdtemp(path.join(tmpdir(), "conform-"));
  const base = path.join(repos, repo);
  const head = path.join(tmp, "head");
  await cp(base, head, { recursive: true });
  for (const [f, content] of Object.entries(files)) {
    const full = path.join(head, f);
    if (content === null) await rm(full, { force: true });
    else {
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content);
    }
  }
  return { base, head, done: () => rm(tmp, { recursive: true, force: true }) };
}

export function hits(p: Plant, f: Finding): boolean {
  if (f.screen !== p.screen || !f.blocking) return false;
  if (p.kind === "redefined") return f.rule === "token-redefined" && f.prop === p.prop;
  if (p.kind === "accessibility") return f.rule === "accessibility" && f.prop === p.prop && f.path.includes(`#${p.testid}`);
  return f.prop === p.prop && f.path.split(">").at(-1)!.endsWith(`#${p.testid}`) && (p.state ?? "rest") === f.state && isViolation(f.rule as never);
}

async function pullRequests(browser: Browser) {
  const names = (await readdir(path.join(dir, "prs")).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort();
  const prs = await Promise.all(names.map(async (f) => JSON.parse(await readFile(path.join(dir, "prs", f), "utf8")) as Pr));
  const rows = await pool(prs, 2, async (pr) => {
    const m = await materialize(pr.repo, pr.files);
    try {
      const r = await reviewPullRequest(browser, m.base, m.head, 2);
      const found = pr.plants.map((p) => r.fresh.some((f) => hits(p, f)));
      const extra = r.fresh.filter((f) => f.blocking && !pr.plants.some((p) => hits(p, f)));
      return { pr, found, extra, screens: r.changedScreens, unresolved: r.fresh.filter((f) => f.rule === "unresolved").length, error: null as string | null };
    } catch (e) {
      return { pr, found: pr.plants.map(() => false), extra: [] as Finding[], screens: [] as string[], unresolved: 0, error: (e as Error).message };
    } finally {
      await m.done();
    }
  });
  const planted = rows.reduce((n, r) => n + r.pr.plants.length, 0);
  const caught = rows.reduce((n, r) => n + r.found.filter(Boolean).length, 0);
  const clean = rows.filter((r) => r.pr.plants.length === 0);
  return {
    planted, caught,
    clean: clean.length, cleanBlocked: clean.filter((r) => r.extra.length > 0 || r.error).length,
    missed: rows.flatMap((r) => r.pr.plants.filter((_p, i) => !r.found[i]).map((p) => ({ pr: r.pr.id, ...p }))),
    extra: rows.flatMap((r) => r.extra.map((f) => ({ pr: r.pr.id, clean: r.pr.plants.length === 0, rule: f.rule, path: f.path, prop: f.prop, state: f.state, detail: f.detail }))),
    errors: rows.filter((r) => r.error).map((r) => ({ pr: r.pr.id, error: r.error })),
  };
}

const AXIS: Record<string, string> = { "padding-left": "padding-inline", "padding-top": "padding-block", "row-gap": "gap" };

/** Both sides came from one value, so the kept one speaks for the asked one. */
const folded = (declared: string, c: TraceCase): boolean => !/gap/.test(c.prop) || splitTop(new RegExp(`gap:\\s*([^;}]+)`).exec(c.css)?.[1] ?? declared, " ").length === 1;

/** One page per case, with a contract that judges every property, so each trace surfaces as a decision. */
async function traces(browser: Browser) {
  const cases = JSON.parse(await readFile(path.join(dir, "traces.json"), "utf8")) as TraceCase[];
  const policy = await loadPolicy(path.join(repos, "key-vault"));
  const all = ["height", "padding-inline", "padding-block", "gap", "background-color", "color", "border-color", "border-radius", "font-size", "font-weight", "box-shadow"];
  const open: Policy = { ...policy, bundle: { ...policy.bundle, themes: ["comfortable-light"], contract: { parts: [], any: Object.fromEntries(all.map((p) => [p, ["*"]])) } } };
  const dsCss = await designSystemCss(open.bundle, "tailwind");
  const rows = await pool(cases, 3, async (c) => {
    const js = `document.getElementById("root").innerHTML=${JSON.stringify(c.html.replace(/id="target"/, 'id="target" data-testid="target"'))}`;
    const { decisions } = await inspectScreen(browser, open, { id: "t", js, appCss: c.css, dsCss, inputs: "" });
    const mine = decisions.filter((d) => d.path.split(">").at(-1)!.endsWith("#target") && d.state === "rest" && d.prop === (AXIS[c.prop] ?? c.prop));
    // Two sides with different values are two decisions. Take the side the case asks about.
    const t: Trace = (mine.find((d) => d.longhand === c.prop) ?? (mine.length === 1 && folded(mine[0]!.declared, c) ? mine[0] : undefined))?.trace ?? { kind: "neutral" };
    const right = t.kind === c.expect.kind && (t.kind !== "token" || t.token === c.expect.token);
    return { id: c.id, expect: c.expect, got: t, outcome: right ? "right" : t.kind === "unresolved" ? "unresolved" : "wrong" };
  });
  const n = (o: string): number => rows.filter((r) => r.outcome === o).length;
  return { total: rows.length, right: n("right"), unresolved: n("unresolved"), wrong: n("wrong"), notRight: rows.filter((r) => r.outcome !== "right") };
}

if (process.argv[1] === import.meta.filename) {
  const browser = await launch();
  const result = { half, pullRequests: await pullRequests(browser), traces: await traces(browser) };
  await browser.close();
  if (process.argv.includes("--write")) {
    await mkdir("results", { recursive: true });
    await writeFile(`results/eval-${half}.json`, `${JSON.stringify(result, null, 2)}\n`);
  }
  const { pullRequests: p, traces: t } = result;
  console.log(`${half}: plants ${p.caught}/${p.planted}, clean blocked ${p.cleanBlocked}/${p.clean}, extra findings ${p.extra.length}, errors ${p.errors.length}`);
  console.log(`traces ${t.right}/${t.total} right, ${t.unresolved} unresolved, ${t.wrong} wrong`);
  for (const m of p.missed) console.log("missed", JSON.stringify(m));
  for (const m of p.extra) console.log("extra", JSON.stringify(m));
  for (const m of p.errors) console.log("error", JSON.stringify(m));
  for (const m of t.notRight) console.log("trace", JSON.stringify(m));
}
