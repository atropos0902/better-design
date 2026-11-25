import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { openBundle, validateWaivers, type Bundle, type Lock, type SignedBundle, type Waiver } from "@conform/core";

const ScreenSchema = z.object({ id: z.string().min(1), module: z.string().min(1) });
const ConfigSchema = z.object({
  repo: z.string().min(1),
  /** Paths are relative to the repository root. */
  bundle: z.string(),
  keys: z.string(),
  styling: z.enum(["tailwind", "css-modules"]),
  /** Design system stylesheet for Tailwind: the `@theme` mapping. Trusted, from the base branch. */
  themeCss: z.string().optional(),
  css: z.array(z.string()).default([]),
  screens: z.array(ScreenSchema).min(1),
});
export type RepoConfig = z.infer<typeof ConfigSchema>;

export interface Policy {
  config: RepoConfig;
  bundle: Bundle;
  baseline: string[];
  waivers: Waiver[];
  themeCss: string | null;
}

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));
const optionalJson = async (file: string, fallback: unknown): Promise<unknown> => {
  try {
    return await readJson(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
};

/**
 * Everything that decides the outcome is read from the base branch: config, bundle, lockfile, baseline and waivers.
 * A pull request that edits any of them changes nothing about its own review.
 */
export async function loadPolicy(baseDir: string): Promise<Policy> {
  const at = (p: string): string => path.resolve(baseDir, p);
  const config = ConfigSchema.parse(await readJson(at("conform.config.json")));
  const signed = (await readJson(at(config.bundle))) as SignedBundle;
  const lock = (await readJson(at("conform.lock.json"))) as Lock;
  const keys = (await readJson(at(config.keys))) as Record<string, JsonWebKey>;
  const bundle = await openBundle(signed, lock, keys);
  const baseline = z.array(z.string()).parse(await optionalJson(at(".conform/baseline.json"), []));
  const waivers = validateWaivers(await optionalJson(at(".conform/waivers.json"), []));
  const themeCss = config.themeCss ? await readFile(at(config.themeCss), "utf8") : null;
  return { config, bundle, baseline, waivers, themeCss };
}

const headConfig = async (dir: string): Promise<Partial<RepoConfig>> => {
  const r = ConfigSchema.partial().safeParse(await optionalJson(path.join(dir, "conform.config.json"), {}));
  return r.success ? r.data : {};
};

/** Stylesheets a pull request adds are loaded, so their rules are judged. It can't drop the ones base has. */
export async function withHeadCss(policy: Policy, headDir: string): Promise<Policy> {
  const root = path.resolve(headDir);
  const extra = ((await headConfig(headDir)).css ?? []).filter((f) => path.resolve(root, f).startsWith(root + path.sep));
  return { ...policy, config: { ...policy.config, css: [...new Set([...policy.config.css, ...extra])] } };
}

/** Screens the head adds are reviewed too; removing one from the config does not hide it. */
export async function screensToReview(policy: Policy, headDir: string): Promise<RepoConfig["screens"]> {
  const head = await headConfig(headDir);
  const byId = new Map(policy.config.screens.map((s) => [s.id, s]));
  for (const s of head.screens ?? []) byId.set(s.id, s);
  return [...byId.values()];
}
