import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { effectiveStage, type Conclusion, type Stage } from "@conform/core";
import { discover, pkceChallenge, randomId, sessionHash, verifyToken } from "./auth.ts";
import { connect, type Db } from "./db.ts";
import type { Env } from "./env.ts";
import { GitHub, verifySignature } from "./github.ts";
import { auditLog, customers, findings, repos, reviews, sessions, waiverCounts } from "./schema.ts";

type Ctx = { Bindings: Env; Variables: { db: Db; session: { customer: string; subject: string; admin: boolean } } };

const PROPS = ["height", "padding-inline", "padding-block", "margin-inline", "margin-block", "gap", "background-color", "color", "border-color", "border-radius", "font-size", "font-weight", "box-shadow"] as const;
const RULES = ["literal-value", "wrong-token", "derived-token", "unresolved", "token-redefined", "accessibility"] as const;
const count = z.number().int().min(0).max(1_000_000);
/** What a runner may send. Strict on purpose: there is no field that could carry source, a name or a path. */
export const Report = z.strictObject({
  pr: z.number().int().positive(),
  headSha: z.string().regex(/^[0-9a-f]{40}$/),
  decisions: count, bound: count, valueMatches: count, unresolved: count, ms: count,
  findings: z.array(z.strictObject({ rule: z.enum(RULES), hash: z.string().regex(/^[0-9a-f]{64}$/), blocking: z.boolean() })).max(5000),
  waivers: z.array(z.strictObject({ rule: z.enum(RULES), prop: z.enum(PROPS), count })).max(200),
});

export const app = new Hono<Ctx>();

app.use(async (c, next) => {
  if (c.req.path === "/healthz") return next();
  // The runtime closes the socket when the request ends. Ending the pool here cancels reads that are still open.
  c.set("db", connect(c.env));
  return next();
});
app.use(async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("cache-control", "no-store");
});
app.onError((e, c) => {
  console.error(e.message);
  return c.json({ error: "internal" }, 500);
});
app.get("/healthz", (c) => c.json({ ok: true }));

// GitHub: one queued check per commit. Nothing from the payload is stored beyond numbers and the commit id.
const PullRequest = z.object({
  action: z.string(),
  pull_request: z.object({ number: z.number().int(), head: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/), repo: z.object({ full_name: z.string() }).nullable() }), base: z.object({ repo: z.object({ full_name: z.string() }) }) }),
});
app.post("/github/webhook", async (c) => {
  const body = await c.req.text();
  if (!(await verifySignature(c.env.GITHUB_WEBHOOK_SECRET, body, c.req.header("x-hub-signature-256")))) return c.json({ error: "bad signature" }, 401);
  if (c.req.header("x-github-event") !== "pull_request") return c.json({ ignored: true });
  const parsed = PullRequest.safeParse(JSON.parse(body));
  if (!parsed.success) return c.json({ error: "bad payload" }, 400);
  const { action, pull_request: pr } = parsed.data;
  if (!["opened", "synchronize", "reopened"].includes(action)) return c.json({ ignored: true });
  const repoName = pr.base.repo.full_name;
  const customer = await c.var.db.customerForRepo(repoName);
  if (!customer) return c.json({ ignored: true });
  const fork = pr.head.repo?.full_name !== repoName;
  const row = await c.var.db.as(customer, async (tx) => {
    const [repo] = await tx.select().from(repos).where(eq(repos.fullName, repoName));
    const [inserted] = await tx.insert(reviews).values({ customerId: customer, repoId: repo!.id, pr: pr.number, headSha: pr.head.sha, fork, ...(fork ? { conclusion: "neutral" as const } : {}) }).onConflictDoNothing().returning();
    return inserted ? { repo: repo!, id: inserted.id } : null;
  });
  if (!row) return c.json({ duplicate: true });
  const checkRunId = await new GitHub(c.env).createCheck(row.repo.installationId, repoName, pr.head.sha, fork
    ? { status: "completed", conclusion: "neutral", title: "Not reviewed", summary: "Pull requests from forks run without a write token, so the result is not enforced." }
    : { status: "queued", title: "Waiting for the runner", summary: "The review runs on your own runner." });
  await c.var.db.as(customer, (tx) => tx.update(reviews).set({ checkRunId }).where(eq(reviews.id, row.id)));
  return c.json({ review: row.id });
});

// Runners: short-lived OIDC token, and the repository comes from its claim, never from the request.
async function runner(c: Context<Ctx>): Promise<{ customer: string; repo: string } | null> {
  const token = /^Bearer (.+)$/.exec(c.req.header("authorization") ?? "")?.[1];
  if (!token) return null;
  const claims = await verifyToken(token, c.env.RUNNER_OIDC_ISSUER, c.env.RUNNER_OIDC_AUDIENCE).catch(() => null);
  const repo = claims?.["repository"];
  if (typeof repo !== "string") return null;
  const customer = await c.var.db.customerForRepo(repo);
  return customer ? { customer, repo } : null;
}

app.get("/v1/gate", async (c) => {
  const who = await runner(c);
  if (!who) return c.json({ error: "unauthorized" }, 401);
  return c.json(await c.var.db.as(who.customer, async (tx) => {
    const [r] = await tx.select({ stage: repos.stage, killSwitch: customers.killSwitch }).from(repos).innerJoin(customers, eq(customers.id, repos.customerId)).where(eq(repos.fullName, who.repo));
    return r!;
  }));
});

const verdict = (stage: Stage, blocking: number): Conclusion => (stage !== "required" ? "neutral" : blocking > 0 ? "failure" : "success");

app.post("/v1/reports", async (c) => {
  const who = await runner(c);
  if (!who) return c.json({ error: "unauthorized" }, 401);
  const parsed = Report.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad report", at: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  const p = parsed.data;
  const blocking = p.findings.filter((f) => f.blocking).length;
  const out = await c.var.db.as(who.customer, async (tx) => {
    // FOR SHARE holds the switch still until this conclusion is stored, so a flip can't be missed.
    const [cust] = await tx.select().from(customers).where(eq(customers.id, who.customer)).for("share");
    const [repo] = await tx.select().from(repos).where(eq(repos.fullName, who.repo));
    const stage = effectiveStage({ stage: repo!.stage, killSwitch: cust!.killSwitch, reachable: true });
    const conclusion = verdict(stage, blocking);
    const numbers = { conclusion, blocking, decisions: p.decisions, bound: p.bound, valueMatches: p.valueMatches, unresolved: p.unresolved, ms: p.ms, reportedAt: new Date() };
    const [review] = await tx.insert(reviews).values({ customerId: who.customer, repoId: repo!.id, pr: p.pr, headSha: p.headSha, fork: false, ...numbers })
      .onConflictDoUpdate({ target: [reviews.repoId, reviews.pr, reviews.headSha], set: numbers, setWhere: eq(reviews.fork, false) }).returning();
    if (!review) return null;
    await tx.delete(findings).where(eq(findings.reviewId, review.id));
    if (p.findings.length) await tx.insert(findings).values(p.findings.map((f) => ({ ...f, reviewId: review.id, customerId: who.customer }))).onConflictDoNothing();
    await tx.delete(waiverCounts).where(eq(waiverCounts.repoId, repo!.id));
    if (p.waivers.length) await tx.insert(waiverCounts).values(p.waivers.map((w) => ({ ...w, repoId: repo!.id, customerId: who.customer }))).onConflictDoNothing();
    return { review, repo: repo!, conclusion, stage };
  });
  if (!out) return c.json({ error: "fork reviews are not enforced" }, 409);
  const gh = new GitHub(c.env);
  const update = { status: "completed" as const, conclusion: out.conclusion, title: blocking ? `${blocking} new finding${blocking === 1 ? "" : "s"}` : "No new findings", summary: summary(p) };
  if (out.review.checkRunId) await gh.updateCheck(out.repo.installationId, who.repo, out.review.checkRunId, update);
  else {
    const checkRunId = await gh.createCheck(out.repo.installationId, who.repo, p.headSha, update);
    await c.var.db.as(who.customer, (tx) => tx.update(reviews).set({ checkRunId }).where(eq(reviews.id, out.review.id)));
  }
  // The kill switch may have flipped while GitHub was being told. The last word has to be neutral.
  const released = out.conclusion === "failure" && (await c.var.db.as(who.customer, async (tx) => {
    const [cust] = await tx.select().from(customers).where(eq(customers.id, who.customer));
    if (!cust!.killSwitch) return false;
    const [r] = await tx.update(reviews).set({ conclusion: "neutral" }).where(eq(reviews.id, out.review.id)).returning();
    await gh.updateCheck(out.repo.installationId, who.repo, r!.checkRunId!, { ...update, conclusion: "neutral", title: "Comments only" });
    return true;
  }));
  return c.json({ conclusion: released ? "neutral" : out.conclusion, stage: released ? "comments" : out.stage });
});

const pct = (a: number, b: number): string => (b ? `${Math.round((a / b) * 100)}%` : "nothing to score");
const summary = (p: z.infer<typeof Report>): string =>
  `Binding score ${pct(p.bound, p.decisions)}, value score ${pct(p.valueMatches, p.decisions)}, ${p.unresolved} unresolved. Details are in the pull request comment.`;

// People: OIDC with PKCE, no client secret. The session id is stored hashed.
app.get("/auth/login", async (c) => {
  const customer = c.req.query("customer") ?? "";
  const [row] = await c.var.db.as(customer, (tx) => tx.select().from(customers));
  if (!row) return c.json({ error: "unknown customer" }, 404);
  const d = await discover(row.oidcIssuer);
  const state = randomId();
  const verifier = randomId();
  const nonce = randomId();
  setCookie(c, "conform_login", JSON.stringify({ customer, state, verifier, nonce }), { httpOnly: true, secure: true, sameSite: "Lax", path: "/auth", maxAge: 600 });
  const u = new URL(d.authorization_endpoint);
  for (const [k, v] of Object.entries({ response_type: "code", client_id: row.oidcClientId, redirect_uri: `${c.env.PUBLIC_URL}/auth/callback`, scope: "openid groups", state, nonce, code_challenge: await pkceChallenge(verifier), code_challenge_method: "S256" })) u.searchParams.set(k, v);
  return c.redirect(u.toString());
});

app.get("/auth/callback", async (c) => {
  const saved = z.object({ customer: z.string(), state: z.string(), verifier: z.string(), nonce: z.string() }).safeParse(JSON.parse(getCookie(c, "conform_login") ?? "null"));
  deleteCookie(c, "conform_login", { path: "/auth" });
  const code = c.req.query("code");
  if (!saved.success || !code || c.req.query("state") !== saved.data.state) return c.json({ error: "bad login" }, 400);
  const { customer, verifier, nonce } = saved.data;
  const [row] = await c.var.db.as(customer, (tx) => tx.select().from(customers));
  if (!row) return c.json({ error: "bad login" }, 400);
  const d = await discover(row.oidcIssuer);
  const res = await fetch(d.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: row.oidcClientId, redirect_uri: `${c.env.PUBLIC_URL}/auth/callback`, code_verifier: verifier }), signal: AbortSignal.timeout(5000) });
  if (!res.ok) return c.json({ error: "bad login" }, 400);
  const { id_token } = (await res.json()) as { id_token: string };
  const claims = await verifyToken(id_token, row.oidcIssuer, row.oidcClientId).catch(() => null);
  if (!claims || claims["nonce"] !== nonce) return c.json({ error: "bad login" }, 400);
  const groups = Array.isArray(claims["groups"]) ? claims["groups"] : [];
  const id = randomId();
  await c.var.db.as(customer, async (tx) => tx.insert(sessions).values({ idHash: await sessionHash(id), customerId: customer, subject: claims.sub!, admin: groups.includes(row.adminGroup), expiresAt: new Date(Date.now() + 8 * 3600_000) }));
  setCookie(c, "conform_session", id, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 8 * 3600 });
  return c.redirect("/");
});

const signedIn = async (c: Context<Ctx>, next: () => Promise<void>): Promise<Response | void> => {
  const id = getCookie(c, "conform_session");
  const hash = id ? await sessionHash(id) : null;
  const customer = hash ? await c.var.db.customerForSession(hash) : null;
  if (!hash || !customer) return c.json({ error: "unauthorized" }, 401);
  const [s] = await c.var.db.as(customer, (tx) => tx.select().from(sessions).where(eq(sessions.idHash, hash)));
  if (!s) return c.json({ error: "unauthorized" }, 401);
  c.set("session", { customer, subject: s.subject, admin: s.admin });
  if (c.req.method !== "GET") {
    if (!s.admin) return c.json({ error: "admins only" }, 403);
    if (c.req.header("origin") !== c.env.PUBLIC_URL) return c.json({ error: "bad origin" }, 403);
  }
  return next();
};
app.use("/v1/admin/*", signedIn);
app.use("/v1/dashboard", signedIn);

app.get("/v1/dashboard", async (c) => {
  const { customer, admin } = c.var.session;
  return c.json(await c.var.db.as(customer, async (tx) => {
    const [cust] = await tx.select().from(customers);
    const perRepo = await tx.select({
      id: repos.id, repo: repos.fullName, stage: repos.stage,
      reviews: sql<number>`count(${reviews.reportedAt})::int`,
      decisions: sql<number>`coalesce(sum(${reviews.decisions}), 0)::int`,
      bound: sql<number>`coalesce(sum(${reviews.bound}), 0)::int`,
      valueMatches: sql<number>`coalesce(sum(${reviews.valueMatches}), 0)::int`,
      unresolved: sql<number>`coalesce(sum(${reviews.unresolved}), 0)::int`,
    }).from(repos).leftJoin(reviews, eq(reviews.repoId, repos.id)).groupBy(repos.id).orderBy(repos.fullName);
    const rules = await tx.select({ rule: findings.rule, count: sql<number>`count(*)::int` }).from(findings).groupBy(findings.rule).orderBy(desc(sql`count(*)`));
    const waivers = await tx.select({ rule: waiverCounts.rule, prop: waiverCounts.prop, count: sql<number>`sum(${waiverCounts.count})::int` }).from(waiverCounts).groupBy(waiverCounts.rule, waiverCounts.prop).orderBy(desc(sql`sum(${waiverCounts.count})`));
    return { customer: cust!.name, killSwitch: cust!.killSwitch, admin, repos: perRepo, rules, waivers: waivers.map((w) => ({ ...w, question: w.count >= 3 })) };
  }));
});

/** Back to comments everywhere, including checks that already failed. */
app.put("/v1/admin/kill-switch", async (c) => {
  const body = z.strictObject({ on: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "bad request" }, 400);
  const { customer, subject } = c.var.session;
  const failed = await c.var.db.as(customer, async (tx) => {
    await tx.update(customers).set({ killSwitch: body.data.on }).where(eq(customers.id, customer));
    await tx.insert(auditLog).values({ customerId: customer, actor: subject, action: "kill-switch", detail: body.data });
    if (!body.data.on) return [];
    return tx.select({ id: reviews.id, checkRunId: reviews.checkRunId, repo: repos.fullName, installationId: repos.installationId }).from(reviews).innerJoin(repos, eq(repos.id, reviews.repoId)).where(and(eq(reviews.conclusion, "failure"), isNotNull(reviews.checkRunId)));
  });
  const gh = new GitHub(c.env);
  const results = await Promise.allSettled(failed.map(async (f) => {
    await gh.updateCheck(f.installationId, f.repo, f.checkRunId!, { status: "completed", conclusion: "neutral", title: "Comments only", summary: "Enforcement was switched off for every repository." });
    await c.var.db.as(customer, (tx) => tx.update(reviews).set({ conclusion: "neutral" }).where(eq(reviews.id, f.id)));
  }));
  return c.json({ on: body.data.on, released: results.filter((r) => r.status === "fulfilled").length, failed: results.filter((r) => r.status === "rejected").length });
});

app.put("/v1/admin/repos/:id/stage", async (c) => {
  const body = z.strictObject({ stage: z.enum(["silent", "comments", "required"]) }).safeParse(await c.req.json().catch(() => null));
  const id = Number(c.req.param("id"));
  if (!body.success || !Number.isSafeInteger(id)) return c.json({ error: "bad request" }, 400);
  const { customer, subject } = c.var.session;
  const changed = await c.var.db.as(customer, async (tx) => {
    const rows = await tx.update(repos).set({ stage: body.data.stage }).where(eq(repos.id, id)).returning({ id: repos.id });
    if (rows.length) await tx.insert(auditLog).values({ customerId: customer, actor: subject, action: "stage", detail: { repo: id, stage: body.data.stage } });
    return rows.length;
  });
  return changed ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});

app.post("/auth/logout", async (c) => {
  const id = getCookie(c, "conform_session");
  const hash = id ? await sessionHash(id) : null;
  const customer = hash ? await c.var.db.customerForSession(hash) : null;
  if (hash && customer) await c.var.db.as(customer, (tx) => tx.delete(sessions).where(eq(sessions.idHash, hash)));
  deleteCookie(c, "conform_session", { path: "/" });
  return c.json({ ok: true });
});
