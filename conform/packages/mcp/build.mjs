import { build } from "esbuild";
await build({ entryPoints: ["src/cli.ts"], outfile: "dist/cli.js", bundle: true, platform: "node", format: "esm", target: "node20", external: ["@modelcontextprotocol/sdk", "tailwindcss", "postcss", "typescript", "zod"] });
