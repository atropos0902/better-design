import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Browser } from "playwright-core";
import { launch, reviewPullRequest, surveyRepo } from "../src/index.ts";

const REPO = path.resolve(import.meta.dirname, "../../../customers/fernhill/repos/booking");
let browser: Browser;
let tmp: string;
beforeAll(async () => {
  browser = await launch();
  tmp = await mkdtemp(path.join(tmpdir(), "fern-"));
});
afterAll(async () => {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
});

test("old drift is found by binding, in both brands", async () => {
  const s = await surveyRepo(browser, REPO);
  expect(s.findings.map((f) => `${f.path.split(">").at(-1)} ${f.prop} ${f.rule} ${f.themes.join("+")}`).sort()).toEqual([
    "field#name border-color literal-value hillside+orchard",
    "panel#form border-radius literal-value hillside+orchard",
    "panel#form padding-block literal-value hillside+orchard",
    "panel#form padding-inline literal-value hillside+orchard",
  ]);
});

test("a pull request that hard-codes one brand's colour fails", async () => {
  const head = path.join(tmp, "head");
  await cp(REPO, head, { recursive: true });
  const css = path.join(head, "src/screens/book.module.css");
  await writeFile(css, (await readFile(css, "utf8")).replace("background-color: var(--fh-semantic-bg-brand)", "background-color: #5a2ca0"));
  const r = await reviewPullRequest(browser, REPO, head);
  expect(r.fresh.map((f) => [f.prop, f.rule, f.blocking])).toEqual([["background-color", "literal-value", true]]);
});
