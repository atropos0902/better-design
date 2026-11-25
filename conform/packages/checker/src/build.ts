import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { compile } from "tailwindcss";
import { Scanner } from "@tailwindcss/oxide";
import type { Bundle } from "@conform/core";
import type { Policy } from "./config.ts";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const tailwindDir = path.dirname(require.resolve("tailwindcss/package.json"));
const modulesDirs = [path.resolve(here, "../node_modules"), path.resolve(here, "../../../node_modules")].filter(existsSync);

export interface BuiltScreen {
  id: string;
  js: string;
  appCss: string;
  dsCss: string;
  /** Hash of every input the screen was built from. */
  inputs: string;
}

/** Token variables per theme plus the reset. The only stylesheet the checker trusts. */
export async function designSystemCss(bundle: Bundle, styling: "tailwind" | "css-modules"): Promise<string> {
  const preflight = styling === "tailwind" ? await readFile(path.join(tailwindDir, "preflight.css"), "utf8") : "*,::before,::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}button,input,select,textarea{font:inherit;color:inherit;background-color:transparent}";
  const themes = bundle.themes.map((t, i) => {
    const vars = bundle.tokens.map((k) => `${k.cssVar}:${k.values[t]};`).join("");
    return `${i === 0 ? ":root," : ""}[data-theme="${t}"]{${vars}}`;
  });
  const rootDecls = Object.entries(bundle.contract.root ?? {}).map(([prop, name]) => {
    const token = bundle.tokens.find((t) => t.name === name);
    if (!token) throw new Error(`contract root uses unknown token ${name}`);
    return `${prop}:var(${token.cssVar});`;
  }).join("");
  return `@layer theme, base, components, utilities;\n@layer base{${preflight}\nbody{${rootDecls}}}\n${themes.join("\n")}\n`;
}

async function tailwindCss(policy: Policy, dir: string, files: string[]): Promise<string> {
  const own = await Promise.all(policy.config.css.map((f) => readFile(path.join(dir, f), "utf8").catch(() => "")));
  const input = [
    "@layer theme, base, components, utilities;",
    '@import "tailwindcss/theme.css" layer(theme);',
    policy.themeCss ?? "",
    '@import "tailwindcss/utilities.css" layer(utilities) source(none);',
    ...own,
  ].join("\n");
  const compiler = await compile(input, {
    base: dir,
    // A pull request's CSS must not be able to run JavaScript on the runner or read other files.
    loadModule: async (id) => {
      throw new Error(`@plugin and @config are not allowed: ${id}`);
    },
    loadStylesheet: async (id) => {
      if (id !== "tailwindcss/theme.css" && id !== "tailwindcss/utilities.css") throw new Error(`@import is not allowed: ${id}`);
      const file = path.join(tailwindDir, path.basename(id));
      return { path: file, base: tailwindDir, content: await readFile(file, "utf8") };
    },
  });
  const contents = await Promise.all(files.map(async (f) => ({ content: await readFile(f, "utf8"), extension: path.extname(f).slice(1) })));
  return compiler.build(new Scanner({}).scanFiles(contents));
}

export async function buildScreen(policy: Policy, dir: string, screen: { id: string; module: string }): Promise<BuiltScreen | null> {
  const root = realpathSync(dir);
  const entry = path.resolve(root, screen.module);
  if (!existsSync(entry)) return null;
  const inside = (f: string): boolean => {
    const real = realpathSync(f);
    return real.startsWith(root + path.sep) || modulesDirs.some((m) => real.startsWith(realpathSync(m) + path.sep));
  };
  const out = await build({
    stdin: {
      contents: `import{createRoot}from"react-dom/client";import{createElement}from"react";import Screen from ${JSON.stringify(entry)};createRoot(document.getElementById("root")).render(createElement(Screen));`,
      resolveDir: root,
      loader: "js",
    },
    absWorkingDir: root,
    bundle: true,
    write: false,
    metafile: true,
    outdir: "/out",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    minifySyntax: true,
    nodePaths: modulesDirs,
    logLevel: "silent",
    tsconfigRaw: {},
    plugins: [{
      name: "stay-inside",
      setup(b) {
        b.onLoad({ filter: /.*/, namespace: "file" }, (a) => {
          if (!inside(a.path)) return { errors: [{ text: `import outside the repository: ${a.path}` }] };
          return undefined;
        });
      },
    }],
  });
  const sources = Object.keys(out.metafile.inputs)
    .map((f) => path.resolve(root, f))
    .filter((f) => f.startsWith(root + path.sep) && existsSync(f) && !f.includes(`${path.sep}node_modules${path.sep}`))
    .sort();
  const js = out.outputFiles.find((f) => f.path.endsWith(".js"))?.text ?? "";
  const moduleCss = out.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
  const tw = policy.config.styling === "tailwind" ? await tailwindCss(policy, root, sources) : "";
  const hash = createHash("sha256");
  for (const f of sources) hash.update(await readFile(f));
  hash.update(tw).update(moduleCss);
  return { id: screen.id, js, appCss: `${tw}\n${moduleCss}`, dsCss: await designSystemCss(policy.bundle, policy.config.styling), inputs: hash.digest("hex") };
}
