// A fake GitHub and two fake identity providers, plus a clean database. Runs in Node, outside the Workers runtime.
import { createServer, type IncomingMessage, type Server } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import postgres from "postgres";

const PORT = 55480;
let server: Server;

const body = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString();
};

export async function startWorld(port = PORT): Promise<Server> {
  const idp = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(idp.publicKey)), kid: "k", alg: "RS256", use: "sig" };
  const checks = new Map<number, Record<string, unknown>>();
  const history: Array<Record<string, unknown>> = [];
  const codes = new Map<string, { nonce: string; challenge: string; groups: string[]; sub: string; aud: string }>();
  let next = 1;
  const s = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://127.0.0.1:${port}`);
    const send = (v: unknown, code = 200): void => {
      res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(v));
    };
    const sign = (claims: Record<string, unknown>, issuer: string, aud: string, sub: string, exp = "5m"): Promise<string> =>
      new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k" }).setIssuer(issuer).setAudience(aud).setSubject(sub).setIssuedAt().setExpirationTime(exp).sign(idp.privateKey);
    const text = await body(req);
    const p = url.pathname;
    const base = `http://127.0.0.1:${port}`;
    if (p === "/test/checks") return send([...checks.values()]);
    if (p === "/test/history") return send(history);
    if (p === "/test/reset") { checks.clear(); history.length = 0; return send({}); }
    if (p === "/test/runner-token") {
      const b = JSON.parse(text) as { repository: string; aud?: string; issuer?: string; exp?: string };
      return send({ token: await sign({ repository: b.repository }, b.issuer ?? `${base}/runner`, b.aud ?? "conform", "runner", b.exp) });
    }
    if (p === "/test/code") {
      const b = JSON.parse(text) as { nonce: string; challenge: string; groups: string[]; sub: string; aud: string };
      const code = `code-${next++}`;
      codes.set(code, b);
      return send({ code });
    }
    const wk = /^\/(runner|idp)\/\.well-known\/openid-configuration$/.exec(p);
    if (wk) return send({ issuer: `${base}/${wk[1]}`, jwks_uri: `${base}/jwks`, authorization_endpoint: `${base}/authorize`, token_endpoint: `${base}/token` });
    if (p === "/jwks") return send({ keys: [jwk] });
    if (p === "/token") {
      const f = new URLSearchParams(text);
      const c = codes.get(f.get("code") ?? "");
      codes.delete(f.get("code") ?? "");
      const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(f.get("code_verifier") ?? ""))).toString("base64url");
      if (!c || digest !== c.challenge) return send({ error: "invalid_grant" }, 400);
      return send({ id_token: await sign({ nonce: c.nonce, groups: c.groups }, `${base}/idp`, c.aud, c.sub) });
    }
    if (/^\/github\/app\/installations\/\d+\/access_tokens$/.test(p)) return send({ token: `inst:${JSON.stringify(JSON.parse(text))}` }, 201);
    if (/^\/github\/repos\/[^/]+\/[^/]+\/check-runs$/.test(p) && req.method === "POST") {
      const id = next++;
      const row = { id, repo: p.split("/").slice(3, 5).join("/"), auth: req.headers.authorization, ...(JSON.parse(text) as object) };
      checks.set(id, row);
      history.push({ ...row });
      return send({ id }, 201);
    }
    const patch = /^\/github\/repos\/[^/]+\/[^/]+\/check-runs\/(\d+)$/.exec(p);
    if (patch && req.method === "PATCH") {
      const row = { ...checks.get(Number(patch[1])), ...(JSON.parse(text) as object), auth: req.headers.authorization };
      checks.set(Number(patch[1]), row);
      history.push({ ...row });
      return send({ id: Number(patch[1]) });
    }
    return send({ error: p }, 404);
  });
  await new Promise<void>((r) => s.listen(port, "127.0.0.1", r));
  return s;
}

export async function seed(url: string, issuerPort = PORT): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`truncate customers, repos, reviews, findings, waiver_counts, sessions, audit_log restart identity cascade`;
  for (const c of ["northgate", "other"]) {
    await sql`insert into customers (id, name, oidc_issuer, oidc_client_id) values (${c}, ${c}, ${`http://127.0.0.1:${issuerPort}/idp`}, ${`client-${c}`})`;
  }
  const names = ["access-review", "cert-rotation", "alert-triage", "secrets-broker", "scan-scheduler", "host-inventory", "incident-log", "firewall-rules", "key-vault", "patch-status", "audit-search", "rollout-gate"];
  for (const n of names) await sql`insert into repos (customer_id, full_name, installation_id, stage) values ('northgate', ${`northgate/${n}`}, 11, 'required')`;
  await sql`insert into repos (customer_id, full_name, installation_id, stage) values ('other', 'other/app', 22, 'required')`;
  await sql.end();
}

export default async function setup(): Promise<() => Promise<void>> {
  await seed("postgres://postgres@127.0.0.1:55432/postgres");
  server = await startWorld();
  return async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  };
}
