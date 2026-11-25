import type { Browser } from "playwright-core";
import type { BuiltScreen } from "@conform/checker";
import type { Step } from "./tasks.ts";

/** Run one task's steps against a built screen. Any step that doesn't hold fails the task. */
export async function functional(browser: Browser, screen: BuiltScreen, steps: Step[]): Promise<boolean> {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await ctx.newPage();
    await ctx.route("**/*", (r) => r.abort());
    page.setDefaultTimeout(2000);
    await page.setContent(`<!doctype html><html lang="en"><head><style>${screen.dsCss}</style><style>${screen.appCss}</style></head><body><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: screen.js });
    const at = (id: string) => page.getByTestId(id);
    for (const s of steps) {
      if ("do" in s) {
        if (s.do === "click") await at(s.id).click();
        else if (s.do === "fill") await at(s.id).fill(s.value);
        else if (s.do === "check") await at(s.id).check();
        else await at(s.id).selectOption(s.value);
      } else if ("see" in s) {
        await at(s.see).first().waitFor({ state: "visible" });
        if (!((await at(s.see).first().textContent()) ?? "").includes(s.text)) return false;
      } else if ("gone" in s) {
        if ((await at(s.gone).count()) > 0 && (await at(s.gone).first().isVisible())) return false;
      } else if ("count" in s) {
        if ((await at(s.count).count()) !== s.n) return false;
      } else if ((await at(s.disabled).isDisabled()) !== s.is) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    await ctx.close();
  }
}
