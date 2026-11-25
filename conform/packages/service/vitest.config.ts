import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { exportPKCS8, generateKeyPair } from "jose";
import { defineConfig } from "vitest/config";

const appKey = await exportPKCS8((await generateKeyPair("RS256", { extractable: true })).privateKey);

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: {
      bindings: {
        DATABASE_URL: "postgres://conform_app@127.0.0.1:55432/postgres",
        PUBLIC_URL: "http://conform.test",
        GITHUB_API_URL: "http://127.0.0.1:55480/github",
        GITHUB_APP_ID: "1",
        GITHUB_APP_KEY: appKey,
        GITHUB_WEBHOOK_SECRET: "hook-secret",
        RUNNER_OIDC_ISSUER: "http://127.0.0.1:55480/runner",
        RUNNER_OIDC_AUDIENCE: "conform",
      },
    },
  })],
  test: { include: ["test/**/*.test.ts"], globalSetup: "./test/fake-world.ts", fileParallelism: false },
});
