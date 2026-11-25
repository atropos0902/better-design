import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser } from "playwright-core";
import { afterAll, beforeAll, expect, test } from "vitest";
import { score } from "@conform/core";
import { buildScreen, inspectScreen, launch, loadPolicy, type Policy } from "@conform/checker";
import { analyze } from "../src/analyze.ts";
import { functional } from "../src/functional.ts";
import { TASKS } from "../src/tasks.ts";

const BASE = path.resolve(import.meta.dirname, "../../../customers/northgate/repos/key-vault");
let browser: Browser;
let policy: Policy;
let dir: string;
beforeAll(async () => {
  browser = await launch();
  policy = await loadPolicy(BASE);
  dir = await mkdtemp(path.join(tmpdir(), "tasks-"));
  await cp(BASE, dir, { recursive: true });
});
afterAll(async () => {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
});
const build = async (code: string) => {
  await writeFile(path.join(dir, "src/screens/task.tsx"), code);
  return (await buildScreen(policy, dir, { id: "task", module: "src/screens/task.tsx" }))!;
};

test("there are 20 tasks", () => expect(new Set(TASKS.map((t) => t.id)).size).toBe(20));

test.each(TASKS)("$id $title: the reference passes and scores 100%, an empty screen fails", async (t) => {
  const built = await build(t.solution);
  expect(await functional(browser, built, t.steps)).toBe(true);
  const seen = await inspectScreen(browser, policy, built);
  expect(seen.decisions.filter((d) => d.verdict !== "bound").map((d) => `${d.path} ${d.prop} ${d.declared}`)).toEqual([]);
  expect(seen.extra.map((f) => `${f.rule} ${f.prop} ${f.path}`)).toEqual([]);
  expect(score(seen.decisions).decisions).toBeGreaterThan(8);
  const empty = await build("export default function S() { return <main><h1>Nothing</h1></main>; }");
  expect(await functional(browser, empty, t.steps)).toBe(false);
}, 60_000);

test("analysis pairs by task", () => {
  const row = (task: string, server: boolean, binding: number, ok = true) => ({ task, agent: "x", server, repeat: 1, version: "1", model: "m", built: true, functional: ok, binding, value: 1, decisions: 10, unresolved: 0, seconds: 1 });
  const r = analyze([row("1", true, 0.9), row("1", false, 0.6), row("2", true, 0.8), row("2", false, 0.5, false), row("3", true, 1)]);
  expect(r.binding.tasks).toBe(2);
  expect(r.binding.mean).toBeCloseTo(0.3);
  expect([r.functionalWith, r.functionalWithout]).toEqual([1, 0.5]);
});
