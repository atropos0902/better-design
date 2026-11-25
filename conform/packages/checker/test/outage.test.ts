import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

const run = promisify(execFile);
const BASE = path.resolve(import.meta.dirname, "../../../customers/northgate/repos/key-vault");
const CLI = path.resolve(import.meta.dirname, "../src/cli.ts");
let tmp: string;
let head: string;
let server: Server;
let url: string;
let mode: "down" | "failing" | "silent" | "required" = "down";
const github: Array<{ route: string; body: any }> = [];

beforeAll(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), "outage-"));
  head = path.join(tmp, "head");
  await cp(BASE, head, { recursive: true });
  const f = path.join(head, "src/screens/keys.tsx");
  await writeFile(f, (await readFile(f, "utf8")).replace("      </section>", '        <button type="button" data-testid="new" className="h-9">New</button>\n      </section>'));
  server = createServer((req, res) => {
    let b = "";
    req.on("data", (d: Buffer) => (b += d));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url!.startsWith("/gh")) {
        github.push({ route: `${req.method} ${req.url}`, body: b ? JSON.parse(b) : null });
        return res.end(req.method === "GET" ? "[]" : '{"id":1}');
      }
      if (mode === "failing") return res.writeHead(500).end("{}");
      if (req.url === "/v1/gate") return res.end(JSON.stringify({ stage: mode, killSwitch: false }));
      return res.end(JSON.stringify({ conclusion: mode === "required" ? "failure" : "neutral", stage: mode }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await rm(tmp, { recursive: true, force: true });
});
beforeEach(() => void (github.length = 0));

const review = async (service: string) => JSON.parse((await run(process.execPath, [CLI, "review", "--base", BASE, "--head", head, "--pr", "3", "--sha", "a".repeat(40)], { env: { ...process.env, CONFORM_SERVICE_URL: service, CONFORM_TOKEN: "t", CONFORM_HASH_KEY: "k", GITHUB_TOKEN: "g", GITHUB_REPOSITORY: "n/key-vault", GITHUB_API_URL: `${url}/gh` } })).stdout);

test.each(["down", "failing"] as const)("service %s: comment, neutral check from the runner, exit 0", async (m) => {
  mode = m;
  const r = await review(m === "down" ? "http://127.0.0.1:9" : url);
  expect(r).toMatchObject({ conclusion: "neutral", stage: "comments", reported: false });
  expect(r.blocking).toBeGreaterThan(0);
  expect(github.map((g) => g.route)).toEqual(["GET /gh/repos/n/key-vault/issues/3/comments?per_page=100", "POST /gh/repos/n/key-vault/issues/3/comments", "POST /gh/repos/n/key-vault/check-runs"]);
  expect(github.at(-1)!.body).toMatchObject({ name: "conform", status: "completed", conclusion: "neutral" });
}, 60_000);

test("silent says nothing on the pull request", async () => {
  mode = "silent";
  expect(await review(url)).toMatchObject({ stage: "silent", reported: true });
  expect(github).toEqual([]);
}, 60_000);

test("required comments and leaves the check to the service", async () => {
  mode = "required";
  expect(await review(url)).toMatchObject({ conclusion: "failure", reported: true });
  expect(github.map((g) => g.route.split(" ")[0])).toEqual(["GET", "POST"]);
  expect(github[1]!.body.body).toContain("Fix before merging");
}, 60_000);
