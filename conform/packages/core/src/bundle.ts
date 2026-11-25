import type { ComponentDoc, Contract } from "./contract.ts";
import type { Token } from "./tokens.ts";

export interface Bundle {
  id: string;
  version: string;
  themes: string[];
  tokens: Token[];
  contract: Contract;
  components: ComponentDoc[];
}

export interface SignedBundle { bundle: Bundle; keyId: string; signature: string }
export interface Lock { id: string; version: string; sha256: string; keyId: string }

/** Stable JSON: object keys sorted at every level. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

const enc = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;
export const toHex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const toB64 = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

export const sha256 = async (s: string): Promise<string> => toHex(await crypto.subtle.digest("SHA-256", enc(s)));

/** Keyed hash for anything derived from source. The key stays on the runner, so short strings can't be guessed back. */
export async function keyedHash(key: string, s: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", k, enc(s)));
}

export async function signBundle(bundle: Bundle, keyId: string, privateJwk: JsonWebKey): Promise<SignedBundle> {
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "Ed25519" }, false, ["sign"]);
  return { bundle, keyId, signature: toB64(await crypto.subtle.sign("Ed25519", key, enc(canonical(bundle)))) };
}

export async function lockFor(b: SignedBundle): Promise<Lock> {
  return { id: b.bundle.id, version: b.bundle.version, sha256: await sha256(canonical(b.bundle)), keyId: b.keyId };
}

/** Signature, key id and lockfile must all agree before a bundle is used. */
export async function openBundle(b: SignedBundle, lock: Lock, keys: Record<string, JsonWebKey>): Promise<Bundle> {
  const jwk = keys[b.keyId];
  if (!jwk) throw new Error(`bundle signed by unknown key ${b.keyId}`);
  if (lock.keyId !== b.keyId) throw new Error(`lockfile expects key ${lock.keyId}, bundle has ${b.keyId}`);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("Ed25519", key, fromB64(b.signature), enc(canonical(b.bundle)));
  if (!ok) throw new Error("bundle signature does not verify");
  const actual = await lockFor(b);
  if (actual.sha256 !== lock.sha256 || actual.id !== lock.id || actual.version !== lock.version) {
    throw new Error(`bundle ${actual.id}@${actual.version} does not match the lockfile (${lock.id}@${lock.version})`);
  }
  return b.bundle;
}
