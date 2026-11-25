import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { openBundle, type Bundle, type Lock, type SignedBundle } from "@conform/core";

export interface Project { root: string; bundle: Bundle; styling: "tailwind" | "css-modules"; themeCss: string }

/** Open the project's pinned bundle. Every failure says what to run or change. */
export async function openProject(dir: string): Promise<Project> {
  const root = realpathSync(dir);
  const read = async (rel: string, fix: string): Promise<string> => {
    try {
      return await readFile(path.join(root, rel), "utf8");
    } catch {
      throw new Error(`${rel} is missing. ${fix}`);
    }
  };
  const json = async (rel: string, fix: string): Promise<any> => {
    const text = await read(rel, fix);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${rel} is not valid JSON. Restore it from your main branch.`);
    }
  };
  const config = await json("conform.config.json", "Run the server from the repository root, or pass --root <dir>.");
  const signed = (await json(config.bundle, "Copy the design system bundle into .conform/ from your main branch.")) as SignedBundle;
  const lock = (await json("conform.lock.json", "Restore it from your main branch so every agent follows the same rules.")) as Lock;
  const keys = (await json(config.keys, "Copy the public keys file into .conform/ from your main branch.")) as Record<string, JsonWebKey>;
  const bundle = await openBundle(signed, lock, keys).catch((e: Error) => {
    throw new Error(`${e.message}. Restore .conform/ and conform.lock.json from your main branch; don't edit them by hand.`);
  });
  const themeCss = config.themeCss ? await read(config.themeCss, "Restore it from your main branch.") : "";
  return { root, bundle, styling: config.styling, themeCss };
}

/** A path inside the project, after following links. Agents can ask for anything; they get project files only. */
export function inside(root: string, file: string): string {
  const full = path.resolve(root, file);
  if (!existsSync(full)) throw new Error(`no such file: ${file}`);
  const real = realpathSync(full);
  if (real !== root && !real.startsWith(root + path.sep)) throw new Error("that file is outside the project");
  return real;
}
