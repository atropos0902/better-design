import { importPKCS8, SignJWT } from "jose";
import type { Env } from "./env.ts";

export class GitHubError extends Error {
  readonly status: number;
  constructor(status: number, what: string) {
    super(`GitHub ${what}: ${status}`);
    this.status = status;
  }
}

export interface CheckUpdate { status: "queued" | "completed"; conclusion?: "success" | "failure" | "neutral"; title: string; summary: string }

/** The service's only use of GitHub: one check run per reviewed commit. */
export class GitHub {
  private readonly env: Env;
  constructor(env: Env) {
    this.env = env;
  }

  /** A token for one repository, with permission to write checks and nothing else. */
  private async token(installationId: number, repo: string): Promise<string> {
    const key = await importPKCS8(this.env.GITHUB_APP_KEY, "RS256");
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({}).setProtectedHeader({ alg: "RS256" }).setIssuer(this.env.GITHUB_APP_ID).setIssuedAt(now - 30).setExpirationTime(now + 300).sign(key);
    const r = await this.call("POST", `/app/installations/${installationId}/access_tokens`, jwt, { repositories: [repo.split("/")[1]], permissions: { checks: "write" } });
    return (r as { token: string }).token;
  }

  private async call(method: string, path: string, token: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.env.GITHUB_API_URL}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "conform" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new GitHubError(res.status, `${method} ${path}`);
    return res.json();
  }

  async createCheck(installationId: number, repo: string, headSha: string, u: CheckUpdate): Promise<number> {
    const r = await this.call("POST", `/repos/${repo}/check-runs`, await this.token(installationId, repo), { name: "conform", head_sha: headSha, ...payload(u) });
    return (r as { id: number }).id;
  }

  async updateCheck(installationId: number, repo: string, checkRunId: number, u: CheckUpdate): Promise<void> {
    await this.call("PATCH", `/repos/${repo}/check-runs/${checkRunId}`, await this.token(installationId, repo), payload(u));
  }
}

const payload = (u: CheckUpdate): Record<string, unknown> => ({
  status: u.status,
  ...(u.conclusion ? { conclusion: u.conclusion } : {}),
  output: { title: u.title, summary: u.summary },
});

export async function verifySignature(secret: string, body: string, header: string | undefined): Promise<boolean> {
  if (!header?.startsWith("sha256=") || !/^[0-9a-f]{64}$/.test(header.slice(7))) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sig = Uint8Array.from(header.slice(7).match(/../g)!, (h) => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(body));
}
