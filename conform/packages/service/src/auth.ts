import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { sha256 } from "@conform/core";

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

interface Discovery { issuer: string; jwks_uri: string; authorization_endpoint: string; token_endpoint: string }

export async function discover(issuer: string): Promise<Discovery> {
  const res = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`discovery failed: ${res.status}`);
  const d = (await res.json()) as Discovery;
  if (d.issuer !== issuer) throw new Error("issuer mismatch");
  return d;
}

export async function verifyToken(token: string, issuer: string, audience: string): Promise<JWTPayload> {
  const d = await discover(issuer);
  let set = jwks.get(d.jwks_uri);
  if (!set) jwks.set(d.jwks_uri, (set = createRemoteJWKSet(new URL(d.jwks_uri))));
  const { payload } = await jwtVerify(token, set, { issuer, audience, algorithms: ["RS256", "ES256"], requiredClaims: ["exp", "sub"] });
  return payload;
}

const b64url = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomId = (): string => b64url(crypto.getRandomValues(new Uint8Array(32)));
export const pkceChallenge = async (verifier: string): Promise<string> => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
export const sessionHash = (id: string): Promise<string> => sha256(id);
