// Build, sign and lock a customer's design system. Usage: node scripts/bundle.ts <customer> <version>
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lockFor, signBundle, type Bundle, type TokenAdapter } from "../packages/core/src/index.ts";

const [customer, version] = process.argv.slice(2);
if (!customer || !version) throw new Error("usage: bundle.ts <customer> <version>");
const dir = path.resolve("customers", customer);
const ds = path.join(dir, "design-system");
const { adapter } = (await import(path.join(dir, "adapter.ts"))) as { adapter: TokenAdapter };
const { themes, tokens } = await adapter.load(ds);
const json = async (f: string): Promise<unknown> => JSON.parse(await readFile(path.join(ds, f), "utf8"));
const bundle: Bundle = {
  id: customer, version, themes, tokens,
  contract: (await json("contract.json")) as Bundle["contract"],
  components: (await json("components.json")) as Bundle["components"],
};

const keyFile = path.resolve("keys", "dev.key.json");
const keyId = "dev-1";
if (!existsSync(keyFile)) {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  await mkdir(path.dirname(keyFile), { recursive: true });
  await writeFile(keyFile, JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)), { mode: 0o600 });
}
const priv = JSON.parse(await readFile(keyFile, "utf8")) as JsonWebKey;
const pub = { kty: priv.kty!, crv: priv.crv!, x: priv.x! };
const signed = await signBundle(bundle, keyId, priv);
const out = path.join(dir, "dist");
await mkdir(out, { recursive: true });
await writeFile(path.join(out, "bundle.json"), `${JSON.stringify(signed, null, 1)}\n`);
await writeFile(path.join(out, "lock.json"), `${JSON.stringify(await lockFor(signed), null, 2)}\n`);
await writeFile(path.join(out, "keys.json"), `${JSON.stringify({ [keyId]: pub }, null, 2)}\n`);
console.log(`${customer}@${version}: ${tokens.length} tokens, ${themes.length} themes`);
