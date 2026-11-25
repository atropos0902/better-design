import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { openProject } from "./project.ts";

export interface Check { name: string; ok: boolean; fix?: string }

/** Each problem with the one thing to run or change. */
export async function doctor(root: string, nodeVersion = process.versions.node): Promise<Check[]> {
  const out: Check[] = [];
  const major = Number(nodeVersion.split(".")[0]);
  out.push(major >= 20 ? { name: `Node ${nodeVersion}`, ok: true } : { name: `Node ${nodeVersion}`, ok: false, fix: "Install Node 20 or newer: nvm install 24" });
  const project = await openProject(root).then((p) => ({ p, e: null }), (e: Error) => ({ p: null, e: e.message }));
  if (project.p) out.push({ name: `Design system ${project.p.bundle.id}@${project.p.bundle.version}, signature and lockfile agree`, ok: true });
  else out.push({ name: "Design system bundle", ok: false, fix: project.e! });
  out.push(await registered(root, "Claude Code", ".mcp.json", "claude mcp add --scope project conform -- npx -y conform-mcp"));
  out.push(await registered(root, "Codex", ".codex/config.toml", "Add to .codex/config.toml:\n[mcp_servers.conform]\ncommand = \"npx\"\nargs = [\"-y\", \"conform-mcp\"]"));
  return out;
}

async function registered(root: string, agent: string, file: string, fix: string): Promise<Check> {
  const full = path.join(root, file);
  if (!existsSync(full)) return { name: `${agent}: ${file}`, ok: false, fix };
  const text = await readFile(full, "utf8");
  if (file.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch {
      return { name: `${agent}: ${file}`, ok: false, fix: `${file} is not valid JSON. Fix it, then run: ${fix}` };
    }
  }
  return text.includes("conform-mcp") ? { name: `${agent}: ${file}`, ok: true } : { name: `${agent}: ${file}`, ok: false, fix };
}
