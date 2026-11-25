// Runner -> service on workerd -> Postgres -> dashboard, with GitHub and the identity provider faked. Leaves screenshots.
import { execFile, spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { seed, startWorld } from "../packages/service/test/fake-world.ts";
import { launch } from "../packages/checker/src/index.ts";
import { materialize } from "./run.ts";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const WORLD = "http://127.0.0.1:55481";
const DASH = "http://127.0.0.1:3100";
const world = await startWorld(55481);
await seed("postgres://postgres@127.0.0.1:55432/postgres", 55481);
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const service = spawn(path.join(ROOT, "node_modules/@cloudflare/workerd-linux-64/bin/workerd"), ["serve", "deploy/workerd.capnp"], { cwd: ROOT, stdio: "ignore", env: { ...process.env, DATABASE_URL: "postgres://conform_app@127.0.0.1:55432/postgres", PUBLIC_URL: DASH, GITHUB_API_URL: `${WORLD}/github`, GITHUB_APP_ID: "1", GITHUB_APP_KEY: privateKey.export({ type: "pkcs8", format: "pem" }) as string, GITHUB_WEBHOOK_SECRET: "hook-secret", RUNNER_OIDC_ISSUER: `${WORLD}/runner`, RUNNER_OIDC_AUDIENCE: "conform" } });
const dash = process.argv.includes("--worker")
  ? spawn("npx", ["wrangler", "dev", "--port", "3100", "--ip", "127.0.0.1"], { cwd: path.join(ROOT, "packages/dashboard"), stdio: "ignore", detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } })
  : spawn("npx", ["next", "start", "-p", "3100", "-H", "127.0.0.1"], { cwd: path.join(ROOT, "packages/dashboard"), stdio: "ignore", detached: true, env: { ...process.env, SERVICE_URL: "http://127.0.0.1:8787", CUSTOMER: "northgate", NEXT_TELEMETRY_DISABLED: "1" } });
const until = async (url: string): Promise<void> => {
  for (let i = 0; i < 300; i++) {
    if (await fetch(url, { redirect: "manual" }).then((r) => r.status < 500, () => false)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url} did not start`);
};
const browser = await launch();
try {
  await until("http://127.0.0.1:8787/healthz");
  await until(DASH);
  if (!process.argv.includes("--worker")) {
    for (let n = 1; n <= 14; n++) {
      const pr = JSON.parse(await readFile(path.join(ROOT, `eval/dev/prs/d-${String(n + (n > 10 ? 25 : 0)).padStart(3, "0")}.json`), "utf8"));
      const m = await materialize(pr.repo, pr.files);
      const { token } = (await (await fetch(`${WORLD}/test/runner-token`, { method: "POST", body: JSON.stringify({ repository: `northgate/${pr.repo}` }) })).json()) as { token: string };
      const { stdout } = await run(process.execPath, [path.join(ROOT, "packages/checker/src/cli.ts"), "review", "--base", m.base, "--head", m.head, "--pr", String(n), "--sha", n.toString(16).padStart(40, "0"), "--out", path.join(ROOT, "results/comment.md")], { env: { ...process.env, CONFORM_SERVICE_URL: "http://127.0.0.1:8787", CONFORM_TOKEN: token, CONFORM_HASH_KEY: "k" } });
      const r = JSON.parse(stdout);
      console.log(pr.id, pr.repo, r.conclusion, r.reported ? "reported" : "NOT REPORTED");
      await m.done();
    }
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1080 } });
  const page = await ctx.newPage();
  // Sign in through the real flow; only the identity provider's own page is skipped.
  const a = await fetch(`${DASH}/auth/login?customer=northgate`, { redirect: "manual" });
  const to = new URL(a.headers.get("location")!);
  const { code } = (await (await fetch(`${WORLD}/test/code`, { method: "POST", body: JSON.stringify({ nonce: to.searchParams.get("nonce"), challenge: to.searchParams.get("code_challenge"), groups: ["conform-admins"], sub: "admin", aud: "client-northgate" }) })).json()) as { code: string };
  const b = await fetch(`${DASH}/auth/callback?code=${code}&state=${to.searchParams.get("state")}`, { redirect: "manual", headers: { cookie: a.headers.getSetCookie()[0]!.split(";")[0]! } });
  const session = b.headers.getSetCookie().find((c) => c.startsWith("conform_session="))!.split(";")[0]!.split("=")[1]!;
  await ctx.addCookies([{ name: "conform_session", value: session, url: DASH }]);
  await page.goto(DASH);
  await page.getByRole("heading", { name: "Repositories" }).waitFor();
  await page.screenshot({ path: "results/screens/dashboard.png", fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "compact-dark"));
  await page.screenshot({ path: "results/screens/dashboard-compact-dark.png", fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "comfortable-light"));
  const sw = page.getByTestId("kill-switch");
  const before = await sw.textContent();
  await sw.click();
  await page.getByText("Enforcement is off").waitFor({ timeout: 10_000 });
  const checks = (await (await fetch(`${WORLD}/test/checks`)).json()) as Array<{ conclusion: string }>;
  console.log(`kill switch from the dashboard: "${before}" clicked, failing checks left: ${checks.filter((c) => c.conclusion === "failure").length} of ${checks.length}`);
  await page.screenshot({ path: "results/screens/dashboard-off.png", fullPage: true });
  await sw.click();
  await page.getByText("Enforcement is off").waitFor({ state: "detached", timeout: 10_000 });
  await page.getByLabel("Stage for northgate/key-vault").selectOption("comments");
  await page.waitForTimeout(800);
  await page.reload();
  console.log("stage after reload:", await page.getByLabel("Stage for northgate/key-vault").inputValue());
  const phone = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await phone.context().addCookies([{ name: "conform_session", value: session, url: DASH }]);
  await phone.goto(DASH);
  console.log("phone overflow px:", await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  const out = await (await browser.newContext()).newPage();
  const res = await out.request.get(DASH, { maxRedirects: 0 });
  console.log("signed out:", res.status(), res.headers()["location"]);
} finally {
  await browser.close();
  service.kill();
  try { process.kill(-dash.pid!); } catch { /* already gone */ }
  world.closeAllConnections();
  world.close();
}
process.exit(0);
