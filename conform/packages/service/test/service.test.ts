import { env, exports } from "cloudflare:workers";
import postgres from "postgres";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { Env } from "../src/env.ts";

const WORLD = "http://127.0.0.1:55480";
const sha = (n: number): string => n.toString(16).padStart(40, "0");
const hash = (n: number): string => n.toString(16).padStart(64, "0");
let e: Env;

const world = async <T>(path: string, body?: unknown): Promise<T> => (await fetch(`${WORLD}${path}`, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) })).json() as Promise<T>;
// Through the deployed entry point, so every call is its own request in the runtime.
const call = (path: string, init: RequestInit = {}) => (exports as unknown as { default: Fetcher }).default.fetch(`http://conform.test${path}`, { redirect: "manual", ...init });
const token = async (repository: string, over: object = {}): Promise<string> => (await world<{ token: string }>("/test/runner-token", { repository, ...over })).token;
const checks = () => world<Array<Record<string, any>>>("/test/checks");

async function webhook(body: unknown, over: { event?: string; signature?: string } = {}) {
  const text = JSON.stringify(body);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("hook-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return call("/github/webhook", { method: "POST", body: text, headers: { "x-github-event": over.event ?? "pull_request", "x-hub-signature-256": over.signature ?? `sha256=${mac}` } });
}
const pr = (repo: string, n: number, head = repo, action = "opened") => ({ action, pull_request: { number: n, title: "ignored", head: { sha: sha(n), repo: { full_name: head } }, base: { repo: { full_name: repo } } } });
const report = (n: number, over: object = {}) => ({ pr: n, headSha: sha(n), decisions: 50, bound: 31, valueMatches: 44, unresolved: 1, ms: 900, findings: [{ rule: "literal-value", hash: hash(n), blocking: true }], waivers: [], ...over });
const send = async (repo: string, body: unknown, t?: string) => call("/v1/reports", { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${t ?? (await token(repo))}`, "content-type": "application/json" } });

async function login(customer: string, groups: string[]): Promise<string> {
  const r = await call(`/auth/login?customer=${customer}`);
  const to = new URL(r.headers.get("location")!);
  const cookie = r.headers.get("set-cookie")!.split(";")[0]!;
  const { code } = await world<{ code: string }>("/test/code", { nonce: to.searchParams.get("nonce"), challenge: to.searchParams.get("code_challenge"), groups, sub: `user-${customer}`, aud: `client-${customer}` });
  const back = await call(`/auth/callback?code=${code}&state=${to.searchParams.get("state")}`, { headers: { cookie } });
  expect(back.status).toBe(302);
  return back.headers.getSetCookie().find((c) => c.startsWith("conform_session="))!.split(";")[0]!;
}
const put = (path: string, cookie: string, body: unknown, origin = "http://conform.test") => call(path, { method: "PUT", body: JSON.stringify(body), headers: { cookie, origin, "content-type": "application/json" } });

beforeAll(() => {
  e = env as unknown as Env;
});
beforeEach(async () => {
  await world("/test/reset", {});
  await put("/v1/admin/kill-switch", await login("northgate", ["conform-admins"]), { on: false });
});

describe("webhook", () => {
  test("a bad signature is refused", async () => {
    expect((await webhook(pr("northgate/key-vault", 1), { signature: `sha256=${"0".repeat(64)}` })).status).toBe(401);
    expect((await webhook(pr("northgate/key-vault", 1), { signature: "sha1=abc" })).status).toBe(401);
    expect(await checks()).toEqual([]);
  });
  test("a pull request gets one queued check, once", async () => {
    expect((await webhook(pr("northgate/key-vault", 10))).status).toBe(200);
    expect(await (await webhook(pr("northgate/key-vault", 10))).json()).toEqual({ duplicate: true });
    const [c, ...rest] = await checks();
    expect(rest).toEqual([]);
    expect(c).toMatchObject({ name: "conform", status: "queued", head_sha: sha(10) });
  });
  test("the installation token is for one repository and checks only", async () => {
    await webhook(pr("northgate/key-vault", 11));
    const [c] = await checks();
    expect(JSON.parse(c!["auth"].replace("Bearer inst:", ""))).toEqual({ repositories: ["key-vault"], permissions: { checks: "write" } });
  });
  test("forks get a neutral check and can't be reported on", async () => {
    await webhook(pr("northgate/key-vault", 12, "someone/key-vault"));
    expect((await checks())[0]).toMatchObject({ status: "completed", conclusion: "neutral" });
    expect((await send("northgate/key-vault", report(12))).status).toBe(409);
    expect((await checks())[0]).toMatchObject({ conclusion: "neutral" });
  });
  test("other events, actions and unknown repositories are ignored", async () => {
    await webhook(pr("northgate/key-vault", 13), { event: "push" });
    await webhook(pr("northgate/key-vault", 13, undefined, "closed"));
    await webhook(pr("nobody/nothing", 13));
    expect(await checks()).toEqual([]);
  });
});

describe("reports", () => {
  test("blocking findings fail the check at the required stage", async () => {
    await webhook(pr("northgate/key-vault", 20));
    const r = await send("northgate/key-vault", report(20));
    expect(await r.json()).toEqual({ conclusion: "failure", stage: "required" });
    const [c] = await checks();
    expect(c).toMatchObject({ status: "completed", conclusion: "failure", output: { title: "1 new finding", summary: "Binding score 62%, value score 88%, 1 unresolved. Details are in the pull request comment." } });
  });
  test("a report without a webhook still makes a check", async () => {
    await send("northgate/key-vault", report(21, { findings: [] }));
    expect(await checks()).toMatchObject([{ conclusion: "success", head_sha: sha(21) }]);
  });
  test("tokens: wrong audience, wrong issuer, expired, none, unknown repository", async () => {
    for (const over of [{ aud: "x" }, { issuer: `${WORLD}/idp` }, { exp: "-1m" }]) expect((await send("northgate/key-vault", report(22), await token("northgate/key-vault", over))).status).toBe(401);
    expect((await call("/v1/reports", { method: "POST" })).status).toBe(401);
    expect((await send("nobody/nothing", report(22))).status).toBe(401);
  });
  test("there is no field that could carry source", async () => {
    for (const extra of [{ detail: "h-10" }, { path: "main" }, { screens: ["keys"] }]) {
      expect((await send("northgate/key-vault", report(23, extra))).status).toBe(400);
      expect((await send("northgate/key-vault", report(23, { findings: [{ rule: "literal-value", hash: hash(1), blocking: true, ...extra }] }))).status).toBe(400);
    }
    expect((await send("northgate/key-vault", report(23, { findings: [{ rule: "const x = 1", hash: hash(1), blocking: true }] }))).status).toBe(400);
    expect((await send("northgate/key-vault", report(23, { findings: [{ rule: "literal-value", hash: "source", blocking: true }] }))).status).toBe(400);
    expect((await send("northgate/key-vault", report(23, { waivers: [{ rule: "literal-value", prop: "secret", count: 1 }] }))).status).toBe(400);
  });
});

describe("people", () => {
  test("no session, forged session, reused state", async () => {
    expect((await call("/v1/dashboard")).status).toBe(401);
    expect((await call("/v1/dashboard", { headers: { cookie: "conform_session=nope" } })).status).toBe(401);
    expect((await call("/auth/callback?code=x&state=y")).status).toBe(400);
    expect((await call("/auth/login?customer=unknown")).status).toBe(404);
  });
  test("a code can't be used with another login's verifier", async () => {
    const a = await call("/auth/login?customer=northgate");
    const b = await call("/auth/login?customer=northgate");
    const ta = new URL(a.headers.get("location")!);
    const tb = new URL(b.headers.get("location")!);
    const { code } = await world<{ code: string }>("/test/code", { nonce: ta.searchParams.get("nonce"), challenge: ta.searchParams.get("code_challenge"), groups: [], sub: "u", aud: "client-northgate" });
    expect((await call(`/auth/callback?code=${code}&state=${tb.searchParams.get("state")}`, { headers: { cookie: b.headers.get("set-cookie")!.split(";")[0]! } })).status).toBe(400);
  });
  test("admin changes need the group and the right origin", async () => {
    const reader = await login("northgate", []);
    const admin = await login("northgate", ["conform-admins"]);
    expect((await put("/v1/admin/kill-switch", reader, { on: true })).status).toBe(403);
    expect((await put("/v1/admin/kill-switch", admin, { on: true }, "http://evil.test")).status).toBe(403);
    expect((await put("/v1/admin/kill-switch", admin, { on: "yes" })).status).toBe(400);
    expect((await call("/v1/dashboard", { headers: { cookie: reader } })).status).toBe(200);
  });
  test("logout ends the session on the server", async () => {
    const cookie = await login("northgate", []);
    await call("/auth/logout", { method: "POST", headers: { cookie } });
    expect((await call("/v1/dashboard", { headers: { cookie } })).status).toBe(401);
  });
});

describe("tenants", () => {
  test("one customer never sees or changes another's rows", async () => {
    const other = await login("other", ["conform-admins"]);
    const d = (await (await call("/v1/dashboard", { headers: { cookie: other } })).json()) as { repos: Array<{ repo: string }> };
    expect(d.repos.map((r) => r.repo)).toEqual(["other/app"]);
    const mine = (await (await call("/v1/dashboard", { headers: { cookie: await login("northgate", []) } })).json()) as { repos: Array<{ id: number }> };
    expect((await put(`/v1/admin/repos/${mine.repos[0]!.id}/stage`, other, { stage: "silent" })).status).toBe(404);
  });
  test("the database role itself is held to one customer", async () => {
    const sql = postgres(e.DATABASE_URL!, { max: 1, prepare: false, fetch_types: false });
    expect(await sql`select * from repos`).toHaveLength(0);
    await sql.begin(async (tx) => {
      await tx`select set_config('app.customer_id', 'other', true)`;
      expect(await tx`select * from repos`).toHaveLength(1);
      expect(await tx`select * from reviews where customer_id = 'northgate'`).toHaveLength(0);
    });
    await expect(sql.begin(async (tx) => {
      await tx`select set_config('app.customer_id', 'other', true)`;
      await tx`insert into reviews (customer_id, repo_id, pr, head_sha) values ('northgate', 1, 1, 'x')`;
    })).rejects.toThrow("row-level security");
    await expect(sql`update customers set name = 'x'`).rejects.toThrow("permission denied");
  });
});

describe("kill switch", () => {
  test("releases checks that already failed and holds new ones to comments", async () => {
    const repos = ["access-review", "cert-rotation", "alert-triage"];
    for (const [i, r] of repos.entries()) {
      await webhook(pr(`northgate/${r}`, 40 + i));
      await send(`northgate/${r}`, report(40 + i));
    }
    const admin = await login("northgate", ["conform-admins"]);
    const r = (await (await put("/v1/admin/kill-switch", admin, { on: true })).json()) as { released: number; failed: number };
    expect(r.failed).toBe(0);
    expect(r.released).toBeGreaterThanOrEqual(3);
    const after = await checks();
    expect(after.filter((c) => repos.some((x) => c["repo"] === `northgate/${x}`))).toHaveLength(3);
    expect(after.filter((c) => c["conclusion"] !== "neutral")).toEqual([]);
    expect(await (await send("northgate/key-vault", report(49))).json()).toEqual({ conclusion: "neutral", stage: "comments" });
    expect(await (await call("/v1/gate", { headers: { authorization: `Bearer ${await token("northgate/key-vault")}` } })).json()).toEqual({ stage: "required", killSwitch: true });
  });
  test("a report in flight when the switch flips never ends as a failure", async () => {
    const admin = await login("northgate", ["conform-admins"]);
    const names = ["access-review", "cert-rotation", "alert-triage", "secrets-broker", "key-vault", "audit-search"];
    await Promise.all([...names.map((n, i) => send(`northgate/${n}`, report(60 + i))), put("/v1/admin/kill-switch", admin, { on: true })]);
    expect((await checks()).filter((c) => c["conclusion"] === "failure")).toEqual([]);
  });
});
