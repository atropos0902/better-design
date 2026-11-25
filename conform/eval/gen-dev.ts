// The dev half. Built from templates: rules are tuned against it, so it is not evidence of anything on its own.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SLOTS, SPECS } from "../scripts/gen-repos.ts";

const out = path.resolve("eval/dev");
const btn = SLOTS["secondary"]!.good;
interface Plant { screen: string; testid: string; prop: string; kind: string; state?: string; note: string }
interface Snip { jsx: (id: string) => string; prop: string; kind: string; state?: string; note: string }

const swap = (cls: string, from: string, to: string): string => cls.split(" ").map((c) => (c === from ? to : c)).filter(Boolean).join(" ");
const b = (cls: string, extra = "") => (id: string): string => `<button type="button" data-testid="${id}" className="${cls}"${extra}>Action</button>`;
const BAD: Snip[] = [
  { jsx: b(swap(btn, "h-control", "h-10")), prop: "height", kind: "literal", note: "h-10" },
  { jsx: b(swap(btn, "h-control", "h-row")), prop: "height", kind: "wrong-token", note: "row height on a control" },
  { jsx: b(swap(btn, "h-control", "")), prop: "height", kind: "missing", note: "no height" },
  { jsx: b(swap(btn, "px-control", "px-4")), prop: "padding-inline", kind: "literal", note: "px-4" },
  { jsx: b(swap(btn, "px-control", "px-medium")), prop: "padding-inline", kind: "wrong-token", note: "space.medium in a control" },
  { jsx: b(swap(btn, "rounded-control", "rounded-[6px]")), prop: "border-radius", kind: "literal", note: "6px" },
  { jsx: b(swap(btn, "rounded-control", "rounded-card")), prop: "border-radius", kind: "wrong-token", note: "card radius" },
  { jsx: b(swap(btn, "text-body", "text-[14px]")), prop: "font-size", kind: "literal", note: "14px" },
  { jsx: b(swap(btn, "font-medium", "font-bold")), prop: "font-weight", kind: "wrong-token", note: "bold control" },
  { jsx: b(swap(btn, "bg-action-secondary", "bg-surface-sunken")), prop: "background-color", kind: "wrong-token", note: "sunken control" },
  { jsx: b(swap(btn, "border-strong", "border-slate-500")), prop: "border-color", kind: "literal", note: "slate" },
  { jsx: b(swap(btn, "hover:bg-action-secondary-hover", "hover:bg-slate-200")), prop: "background-color", kind: "literal", state: "hover", note: "hover literal" },
  { jsx: b(`${btn} focus:bg-slate-100`), prop: "background-color", kind: "literal", state: "focus", note: "focus literal" },
  { jsx: b(swap(btn, "h-control", ""), ' style={{ height: 40 }}'), prop: "height", kind: "literal", note: "inline 40" },
  { jsx: b(swap(btn, "h-control", "h-[calc(var(--ng-control-height)*0.75)]")), prop: "height", kind: "literal", note: "token times factor" },
  { jsx: (id) => `<p data-testid="${id}" className="text-body text-[#515b6b]">Note</p>`, prop: "color", kind: "literal", note: "hex equal to muted" },
  { jsx: (id) => `<p data-testid="${id}" className="text-sm text-muted">Note</p>`, prop: "font-size", kind: "literal", note: "text-sm" },
  { jsx: (id) => `<div data-testid="${id}" className="flex gap-2"><span>One</span><span>Two</span></div>`, prop: "gap", kind: "literal", note: "gap-2" },
  { jsx: (id) => `<div data-testid="${id}" className="px-[16px]">Box</div>`, prop: "padding-inline", kind: "literal", note: "px-[16px]" },
  { jsx: (id) => `<div data-testid="${id}" style={{ "--pad": "8px", paddingTop: "var(--pad)" } as React.CSSProperties}>Box</div>`, prop: "padding-block", kind: "literal", note: "alias to literal" },
  { jsx: (id) => `<div data-testid="${id}" className="bg-action-primary text-on-action p-small">Banner</div>`, prop: "background-color", kind: "wrong-token", note: "action colour on a box" },
  { jsx: (id) => `<div data-testid="${id}" className="shadow-md bg-surface-raised">Box</div>`, prop: "box-shadow", kind: "literal", note: "shadow-md" },
  { jsx: (id) => `<span data-testid="${id}" data-status="ok" className="text-caption font-medium text-muted">Done</span>`, prop: "color", kind: "wrong-token", note: "muted status" },
  { jsx: (id) => `<button type="button" data-testid="${id}" className="${btn}"></button>`, prop: "button-name", kind: "accessibility", note: "no name" },
  { jsx: (id) => `<div data-testid="${id}" style={{ "--ng-space-small": "10px" } as React.CSSProperties}>Box</div>`, prop: "--ng-space-small", kind: "redefined", note: "inline override" },
];
const GOOD: Array<(id: string) => string> = [
  b(btn),
  b(SLOTS["danger"]!.good),
  (id) => `<p data-testid="${id}" className="text-body text-muted">Nothing to do.</p>`,
  (id) => `<div data-testid="${id}" className="flex gap-small p-0 m-auto w-1/2 bg-transparent"><span>One</span></div>`,
  (id) => `<div data-testid="${id}" className="bg-[var(--ng-surface-sunken)] p-small rounded-control">Box</div>`,
  (id) => `<div data-testid="${id}" style={{ "--pad": "var(--ng-space-small)", padding: "var(--pad)" } as React.CSSProperties}>Box</div>`,
  (id) => `<span data-testid="${id}" data-status="warn" className="text-caption font-medium rounded-control px-small py-tight text-warn">Late</span>`,
  (id) => `<div data-testid="${id}" className="pl-small pr-medium border border-default max-w-prose">Box</div>`,
];

await rm(path.join(out, "prs"), { recursive: true, force: true });
await mkdir(path.join(out, "prs"), { recursive: true });
let planted = 0;
for (let n = 0; n < 50; n++) {
  const spec = SPECS[n % SPECS.length]!;
  const screen = spec.screens[n % spec.screens.length]!;
  const file = `src/screens/${screen.id}.tsx`;
  const base = await readFile(path.resolve("customers/northgate/repos", spec.repo, file), "utf8");
  const plants: Plant[] = [];
  const parts: string[] = [];
  // 30 pull requests with 2 or 3 plants each make 75.
  const count = n < 30 ? (n % 2 ? 3 : 2) : 0;
  for (let k = 0; k < count; k++) {
    const s = BAD[(planted + k) % BAD.length]!;
    const id = `new-${k}`;
    parts.push(s.jsx(id));
    plants.push({ screen: screen.id, testid: id, prop: s.prop, kind: s.kind, note: s.note, ...(s.state ? { state: s.state } : {}) });
  }
  planted += count;
  for (let k = 0; k < (count ? 1 : 4); k++) parts.push(GOOD[(n + k) % GOOD.length]!(`ok-${k}`));
  const next = base.replace("      </section>", `        <div className="flex flex-col gap-small">\n          ${parts.join("\n          ")}\n        </div>\n      </section>`);
  if (next === base) throw new Error(`no insertion point in ${spec.repo}/${file}`);
  const id = `d-${String(n + 1).padStart(3, "0")}`;
  await writeFile(path.join(out, "prs", `${id}.json`), `${JSON.stringify({ id, repo: spec.repo, title: `Change ${screen.title}`, body: "", files: { [file]: next }, plants }, null, 1)}\n`);
}

const T = ["space.small", "space.medium", "card.padding", "control.padding", "space.large"];
const C = ["text.primary", "text.muted", "status.ok", "status.critical", "text.link"];
const v = (n: string): string => `var(--ng-${n.replace(/\./g, "-")})`;
type Case = { css: string; html: string; prop: string; expect: { kind: string; token?: string } };
const p = (cls: string, attr = ""): string => `<p id="target" class="${cls}"${attr}>text</p>`;
const cases: Case[] = [];
for (let i = 0; i < 15; i++) {
  const s = T[i % 5]!;
  const s2 = T[(i + 1) % 5]!;
  const c = C[i % 5]!;
  const c2 = C[(i + 2) % 5]!;
  cases.push(
    { css: `.a{padding-left:${v(s)}}`, html: p("a"), prop: "padding-left", expect: { kind: "token", token: s } },
    { css: `:root{--x:${v(s)};--y:var(--x)}.a{padding:var(--y)}`, html: p("a"), prop: "padding-top", expect: { kind: "token", token: s } },
    { css: `.a{color:var(--nope,${v(c)})}`, html: p("a"), prop: "color", expect: { kind: "token", token: c } },
    { css: `@layer components{#target{color:${v(c)}}}@layer utilities{.a{color:${v(c2)}}}`, html: p("a"), prop: "color", expect: { kind: "token", token: c2 } },
    { css: `.a{color:${v(c)}!important}`, html: p("a", ` style="color:${v(c2)}"`), prop: "color", expect: { kind: "token", token: c } },
    { css: `.a{padding-left:calc(${v(s)} * 2)}@media (max-width:600px){.a{padding-left:${v(s2)}}}`, html: p("a"), prop: "padding-left", expect: { kind: "token", token: s } },
    { css: `.a{padding-left:${8 + i}px}`, html: p("a"), prop: "padding-left", expect: { kind: "literal" } },
    { css: `.w{--x:${4 + i}px}:root{--x:${v(s)}}.a{padding-left:var(--x)}`, html: `<div class="w">${p("a")}</div>`, prop: "padding-left", expect: { kind: "literal" } },
    { css: `.a{border:1px solid ${v(c)}}`, html: p("a"), prop: "border-color", expect: { kind: "token", token: c } },
    { css: `.a{padding-left:${["0", "0px", "10%", "inherit", "unset"][i % 5]}}`, html: p("a"), prop: "padding-left", expect: { kind: "neutral" } },
  );
}
await writeFile(path.join(out, "traces.json"), `${JSON.stringify(cases.map((c, i) => ({ id: `d-t-${String(i + 1).padStart(3, "0")}`, ...c })), null, 1)}\n`);
console.log(`${planted} plants, ${cases.length} traces`);
