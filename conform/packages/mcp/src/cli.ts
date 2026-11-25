#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { doctor } from "./doctor.ts";
import { createServer } from "./server.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--root");
const root = path.resolve(at >= 0 ? (args[at + 1] ?? ".") : ".");
const command = args.find((a, i) => !a.startsWith("--") && i !== at + 1) ?? "serve";

if (command === "serve") {
  await createServer(root).connect(new StdioServerTransport());
} else if (command === "doctor") {
  const checks = await doctor(root);
  for (const c of checks) console.log(c.ok ? `ok    ${c.name}` : `fix   ${c.name}\n      ${c.fix!.replace(/\n/g, "\n      ")}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
} else if (command === "setup") {
  // Adds one entry to each agent's project config and leaves everything else in the file alone.
  const mcp = path.join(root, ".mcp.json");
  const current = existsSync(mcp) ? (JSON.parse(await readFile(mcp, "utf8")) as { mcpServers?: Record<string, unknown> }) : {};
  current.mcpServers = { ...current.mcpServers, conform: { command: "npx", args: ["-y", "conform-mcp"] } };
  await writeFile(mcp, `${JSON.stringify(current, null, 2)}\n`);
  const codex = path.join(root, ".codex/config.toml");
  const toml = existsSync(codex) ? await readFile(codex, "utf8") : "";
  if (!toml.includes("[mcp_servers.conform]")) {
    await mkdir(path.dirname(codex), { recursive: true });
    await writeFile(codex, `${toml}${toml && !toml.endsWith("\n") ? "\n" : ""}${toml ? "\n" : ""}[mcp_servers.conform]\ncommand = "npx"\nargs = ["-y", "conform-mcp"]\n`);
  }
  console.log("Added conform to .mcp.json and .codex/config.toml. Restart your agent, then run: npx conform-mcp doctor");
} else {
  console.error("usage: conform-mcp [serve|setup|doctor] [--root <dir>]");
  process.exitCode = 2;
}
