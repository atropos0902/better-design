// 20 tasks x 2 agents x with/without the server x 3 repeats = 240 runs. Resumable: finished runs are skipped.
// Usage: node src/run.ts --agent claude|codex|stub [--out results/experiment.jsonl] [--tasks 01,02] [--repeats 3]
import { execFile } from "node:child_process";
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { score } from "@conform/core";
import { buildScreen, inspectScreen, launch, loadPolicy } from "@conform/checker";
import { functional } from "./functional.ts";
import { prompt, TASKS, type Task } from "./tasks.ts";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "../../..");
const BASE = path.join(ROOT, "customers/northgate/repos/key-vault");
const VERSIONS = { claude: /^2\.1\./, codex: /\b0\.128\./ };

export interface Row { task: string; agent: string; server: boolean; repeat: number; version: string; model: string; built: boolean; functional: boolean; binding: number; value: number; decisions: number; unresolved: number; seconds: number }

const { values } = parseArgs({ options: { agent: { type: "string" }, out: { type: "string" }, tasks: { type: "string" }, repeats: { type: "string" }, model: { type: "string" } } });
const agent = values.agent as "claude" | "codex" | "stub";
if (!["claude", "codex", "stub"].includes(agent)) throw new Error("--agent claude|codex|stub");
const out = path.resolve(values.out ?? (agent === "stub" ? "results/experiment-stub.jsonl" : "results/experiment.jsonl"));
const model = values.model ?? "default";

async function version(): Promise<string> {
  if (agent === "stub") return "stub";
  const { stdout } = await run(agent, ["--version"]);
  if (!VERSIONS[agent].test(stdout.trim())) throw new Error(`${agent} ${stdout.trim()} is not the pinned version`);
  return stdout.trim();
}

/** The agent sees source and theme either way. Only the server differs. */
async function workspace(server: boolean): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "exp-"));
  await cp(path.join(BASE, "src"), path.join(dir, "src"), { recursive: true });
  await mkdir(path.join(dir, ".conform"));
  await cp(path.join(BASE, ".conform/theme.css"), path.join(dir, ".conform/theme.css"));
  if (server) {
    for (const f of [".conform/bundle.json", ".conform/keys.json", "conform.lock.json", "conform.config.json"]) await cp(path.join(BASE, f), path.join(dir, f));
    const command = { command: process.execPath, args: [path.join(ROOT, "packages/mcp/dist/cli.js"), "--root", dir] };
    await writeFile(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { conform: command } }));
    await mkdir(path.join(dir, ".codex"));
    await writeFile(path.join(dir, ".codex/config.toml"), `[mcp_servers.conform]\ncommand = ${JSON.stringify(command.command)}\nargs = ${JSON.stringify(command.args)}\n`);
  }
  return dir;
}

async function ask(t: Task, dir: string, server: boolean): Promise<void> {
  const opts = { cwd: dir, timeout: 15 * 60_000, maxBuffer: 64 << 20 };
  if (agent === "claude") {
    await run("claude", ["-p", prompt(t), "--output-format", "json", "--permission-mode", "acceptEdits", "--strict-mcp-config", ...(server ? ["--mcp-config", ".mcp.json", "--allowedTools", "mcp__conform"] : []), ...(values.model ? ["--model", values.model] : [])], opts);
  } else if (agent === "codex") {
    await run("codex", ["exec", "--full-auto", "--skip-git-repo-check", "--ephemeral", ...(values.model ? ["-m", values.model] : []), prompt(t)], { ...opts, env: { ...process.env, ...(server ? { CODEX_HOME: path.join(dir, ".codex") } : {}) } });
  } else {
    // Checks the pipeline only. Its rows go to their own file and are never reported as a result.
    const code = server ? t.solution : t.solution.replaceAll("h-control", "h-10").replaceAll("px-control", "px-4").replaceAll("text-body", "text-sm").replaceAll("gap-small", "gap-2");
    await writeFile(path.join(dir, "src/screens/task.tsx"), code);
  }
}

const v = await version();
const policy = await loadPolicy(BASE);
const done = new Set((await readFile(out, "utf8").catch(() => "")).split("\n").filter(Boolean).map((l) => {
  const r = JSON.parse(l) as Row;
  return `${r.task}|${r.agent}|${r.server}|${r.repeat}`;
}));
await mkdir(path.dirname(out), { recursive: true });
const browser = await launch();
for (const t of TASKS.filter((x) => !values.tasks || values.tasks.split(",").includes(x.id))) {
  for (let repeat = 1; repeat <= Number(values.repeats ?? 3); repeat++) {
    // Alternate which condition goes first, so a slow hour doesn't land on one side.
    for (const server of repeat % 2 ? [true, false] : [false, true]) {
      if (done.has(`${t.id}|${agent}|${server}|${repeat}`)) continue;
      const dir = await workspace(server);
      const started = Date.now();
      await ask(t, dir, server).catch((e: Error) => console.error(t.id, e.message.slice(0, 200)));
      const row: Row = { task: t.id, agent, server, repeat, version: v, model, built: false, functional: false, binding: 0, value: 0, decisions: 0, unresolved: 0, seconds: Math.round((Date.now() - started) / 1000) };
      try {
        const built = await buildScreen(policy, dir, { id: "task", module: "src/screens/task.tsx" });
        if (built) {
          row.built = true;
          row.functional = await functional(browser, built, t.steps);
          const s = score((await inspectScreen(browser, policy, built)).decisions);
          Object.assign(row, { binding: s.binding, value: s.value, decisions: s.decisions, unresolved: s.unresolved });
        }
      } catch (e) {
        console.error(t.id, (e as Error).message.slice(0, 200));
      }
      await appendFile(out, `${JSON.stringify(row)}\n`);
      await rm(dir, { recursive: true, force: true });
    }
  }
}
await browser.close();
