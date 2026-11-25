// Writes Northgate's 12 synthetic console repositories. Deterministic: same input, same files.
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("customers/northgate");

/** Classes the design system asks for, and what the older screens drifted to. */
export const SLOTS: Record<string, { good: string; drift: string[] }> = {
  main: { good: "bg-surface-page p-section flex flex-col gap-large min-h-screen", drift: ["bg-slate-100 p-8 flex flex-col gap-6 min-h-screen", "bg-surface-page p-8 flex flex-col gap-large min-h-screen"] },
  title: { good: "text-title font-bold text-primary", drift: ["text-2xl font-bold text-slate-900", "text-title font-semibold text-primary", "text-[24px] font-bold text-primary"] },
  section: { good: "p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium", drift: ["p-6 rounded-lg bg-white border border-slate-200 shadow flex flex-col gap-4", "p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4"] },
  heading: { good: "text-heading font-bold text-primary", drift: ["text-lg font-bold text-slate-900", "text-heading font-medium text-primary"] },
  primary: { good: "h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action", drift: ["h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white", "h-10 px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action", "h-control px-4 rounded-control text-body font-medium bg-action-primary hover:bg-blue-700 text-on-action"] },
  secondary: { good: "h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong", drift: ["h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500", "h-9 px-control rounded-control text-body font-medium bg-action-secondary text-primary border border-strong"] },
  danger: { good: "h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action", drift: ["h-10 px-4 rounded-md text-sm font-medium bg-red-600 text-white", "h-control px-control rounded-control text-body font-medium bg-red-600 text-on-action"] },
  field: { good: "h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong", drift: ["h-10 px-3 rounded-md text-sm bg-white text-slate-900 border border-slate-500", "h-10 px-control rounded-control text-body bg-surface-raised text-primary border border-strong"] },
  label: { good: "text-caption font-medium text-muted", drift: ["text-xs font-medium text-slate-600", "text-sm font-medium text-muted"] },
  th: { good: "text-caption font-medium text-muted px-medium text-left", drift: ["text-xs font-medium text-slate-600 px-4 text-left", "text-caption font-bold text-muted px-medium text-left"] },
  tr: { good: "h-row border-b border-default", drift: ["h-12 border-b border-slate-200", "h-12 border-b border-default"] },
  td: { good: "text-body px-medium text-primary", drift: ["text-sm px-4 text-slate-900", "text-body px-4 text-primary"] },
  status: { good: "text-caption font-medium rounded-control px-small py-tight", drift: ["text-xs font-medium rounded px-2 py-1", "text-caption font-medium rounded px-small py-tight"] },
  toolbar: { good: "flex items-end gap-small", drift: ["flex items-end gap-2", "flex items-end gap-[10px]"] },
  note: { good: "text-body text-muted", drift: ["text-sm text-slate-500", "text-sm text-muted"] },
};

interface Spec { repo: string; drift: number; screens: Array<{ id: string; kind: "table" | "form" | "detail"; title: string; noun: string; columns: string[]; rows: string[][]; main: string; danger: string }> }

const t = (id: string, title: string, noun: string, columns: string[], rows: string[][], main: string, danger: string, kind: "table" | "form" | "detail" = "table"): Spec["screens"][number] => ({ id, kind, title, noun, columns, rows, main, danger });

export const SPECS: Spec[] = [
  { repo: "access-review", drift: 0.55, screens: [t("campaigns", "Access campaigns", "campaign", ["Campaign", "Owner", "Status"], [["Contractors", "IAM team", "ok"], ["Admin roles", "Platform", "warn"]], "Start campaign", "Cancel campaign"), t("decide", "Review a grant", "grant", ["Grant", "Reason", "Approver"], [["prod-read", "On-call", "Lead"]], "Keep access", "Revoke access", "detail")] },
  { repo: "cert-rotation", drift: 0.4, screens: [t("certs", "Certificates", "certificate", ["Host", "Issuer", "Status"], [["edge-1", "Internal CA", "ok"], ["edge-2", "Internal CA", "critical"]], "Rotate now", "Revoke"), t("policy", "Rotation policy", "policy", ["Lifetime", "Warning", "Owner"], [["90", "14", "Edge"]], "Save policy", "Reset", "form")] },
  { repo: "alert-triage", drift: 0.7, screens: [t("queue", "Alert queue", "alert", ["Alert", "Source", "Status"], [["Impossible travel", "SSO", "critical"], ["New admin", "Directory", "warn"]], "Assign to me", "Dismiss"), t("alert", "Alert detail", "alert", ["Alert", "Entity", "Severity"], [["Impossible travel", "user-118", "High"]], "Escalate", "Close alert", "detail"), t("rule", "Edit rule", "rule", ["Name", "Threshold", "Window"], [["Failed logins", "20", "10m"]], "Save rule", "Delete rule", "form")] },
  { repo: "secrets-broker", drift: 0.35, screens: [t("leases", "Active leases", "lease", ["Secret", "Holder", "Status"], [["db/reports", "batch-7", "ok"], ["db/ledger", "api-2", "warn"]], "Issue lease", "Revoke lease"), t("issue", "Issue a lease", "lease", ["Secret", "Purpose", "Duration"], [["db/reports", "Backfill", "1h"]], "Issue", "Clear", "form")] },
  { repo: "scan-scheduler", drift: 0.6, screens: [t("jobs", "Scan jobs", "job", ["Job", "Target", "Status"], [["Nightly", "All hosts", "ok"], ["Weekly deep", "Edge", "warn"]], "Run scan", "Stop scan"), t("job", "Schedule a scan", "scan", ["Target", "Profile", "Window"], [["Edge", "Deep", "02:00"]], "Schedule", "Discard", "form")] },
  { repo: "host-inventory", drift: 0.5, screens: [t("hosts", "Hosts", "host", ["Host", "Pool", "Status"], [["web-001", "web", "ok"], ["web-002", "web", "critical"]], "Add host", "Retire host"), t("host", "Host detail", "host", ["Host", "Kernel", "Owner"], [["web-001", "6.8", "Web"]], "Drain host", "Retire host", "detail")] },
  { repo: "incident-log", drift: 0.65, screens: [t("incidents", "Incidents", "incident", ["Incident", "Lead", "Status"], [["Login outage", "SRE", "critical"], ["Slow search", "Search", "warn"]], "Open incident", "Delete draft"), t("update", "Post an update", "update", ["Headline", "Impact", "Next step"], [["Mitigated", "None", "Review"]], "Post update", "Discard", "form")] },
  { repo: "firewall-rules", drift: 0.45, screens: [t("rules", "Firewall rules", "rule", ["Rule", "Zone", "Status"], [["allow-https", "edge", "ok"], ["deny-smb", "core", "ok"]], "Add rule", "Disable rule"), t("change", "Change request", "change", ["Rule", "Requester", "Window"], [["allow-dns", "Net", "Sunday"]], "Approve", "Reject", "detail")] },
  { repo: "key-vault", drift: 0.3, screens: [t("keys", "Keys", "key", ["Key", "Use", "Status"], [["sign-2", "Signing", "ok"], ["wrap-1", "Wrapping", "warn"]], "Create key", "Schedule deletion"), t("rotate", "Rotate a key", "key", ["Key", "Version", "Reason"], [["sign-2", "4", "Schedule"]], "Rotate key", "Cancel", "form")] },
  { repo: "patch-status", drift: 0.55, screens: [t("patches", "Patch status", "patch", ["Package", "Hosts", "Status"], [["openssl", "412", "warn"], ["glibc", "88", "critical"]], "Start rollout", "Pause rollout"), t("wave", "Rollout wave", "wave", ["Wave", "Hosts", "Health"], [["2", "120", "Good"]], "Advance wave", "Roll back", "detail")] },
  { repo: "audit-search", drift: 0.5, screens: [t("search", "Audit search", "event", ["Event", "Actor", "Status"], [["role.grant", "svc-iam", "ok"], ["key.export", "user-52", "critical"]], "Search", "Clear filters"), t("export", "Export events", "export", ["Range", "Format", "Reason"], [["7 days", "CSV", "Legal"]], "Start export", "Cancel", "form")] },
  { repo: "rollout-gate", drift: 0.4, screens: [t("gates", "Rollout gates", "gate", ["Service", "Stage", "Status"], [["search-api", "Canary", "ok"], ["feed-api", "Region 1", "warn"]], "Open gate", "Close gate"), t("gate", "Gate detail", "gate", ["Service", "Error rate", "Owner"], [["feed-api", "0.4%", "Feed"]], "Promote", "Roll back", "detail")] },
];

function rng(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function renderScreen(s: Spec["screens"][number], cls: (slot: string) => string): string {
  const name = s.id.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());
  const statusColor = (v: string): string => (v === "ok" ? "text-ok" : v === "warn" ? "text-warn" : "text-critical");
  const statusText = (v: string): string => ({ ok: "Healthy", warn: "Needs attention", critical: "Failing" })[v] ?? v;
  const actions = `<div className="${cls("toolbar")}">
          <button type="button" data-testid="main-action" className="${cls("primary")}">${s.main}</button>
          <button type="button" data-testid="second-action" className="${cls("secondary")}">Export</button>
          <button type="button" data-testid="danger-action" className="${cls("danger")}">${s.danger}</button>
        </div>`;
  let body = "";
  if (s.kind === "table") {
    const rows = s.rows.map((r) => `            <tr className="${cls("tr")}">
${r.map((v, i) => (s.columns[i] === "Status" ? `              <td className="${cls("td")}"><span data-status="${v}" className="${cls("status")} ${statusColor(v)}">${statusText(v)}</span></td>` : `              <td className="${cls("td")}">${v}</td>`)).join("\n")}
            </tr>`).join("\n");
    body = `<section data-testid="list" className="${cls("section")}">
        <h2 className="${cls("heading")}">All ${s.noun}s</h2>
        <table className="w-full">
          <thead>
            <tr>${s.columns.map((c) => `<th className="${cls("th")}">${c}</th>`).join("")}</tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
        ${actions}
      </section>`;
  } else if (s.kind === "form") {
    body = `<section data-testid="form" className="${cls("section")}">
        <h2 className="${cls("heading")}">${s.noun[0]!.toUpperCase()}${s.noun.slice(1)} settings</h2>
        <form className="flex flex-col ${cls("toolbar").split(" ").at(-1)}">
${s.columns.map((c, i) => `          <label htmlFor="f${i}" className="${cls("label")}">${c}</label>
          <input id="f${i}" data-testid="field-${i}" defaultValue="${s.rows[0]![i]}" className="${cls("field")}" />`).join("\n")}
        </form>
        ${actions}
      </section>`;
  } else {
    body = `<section data-testid="detail" className="${cls("section")}">
        <h2 className="${cls("heading")}">${s.rows[0]![0]}</h2>
${s.columns.map((c, i) => `        <p className="${cls("note")}">${c}: ${s.rows[0]![i]}</p>`).join("\n")}
        ${actions}
      </section>`;
  }
  return `export default function ${name}() {
  return (
    <main className="${cls("main")}">
      <h1 className="${cls("title")}">${s.title}</h1>
      ${body}
    </main>
  );
}
`;
}

export function slotPicker(spec: Spec, screen: string): (slot: string) => string {
  const rand = rng(`${spec.repo}/${screen}`);
  const chosen = new Map<string, string>();
  return (slot) => {
    const seen = chosen.get(slot);
    if (seen) return seen;
    const s = SLOTS[slot]!;
    const v = rand() < spec.drift ? s.drift[Math.floor(rand() * s.drift.length)]! : s.good;
    chosen.set(slot, v);
    return v;
  };
}

if (process.argv[1] === import.meta.filename) {
  await rm(path.join(ROOT, "repos"), { recursive: true, force: true });
  for (const spec of SPECS) {
    const dir = path.join(ROOT, "repos", spec.repo);
    await mkdir(path.join(dir, "src/screens"), { recursive: true });
    await mkdir(path.join(dir, ".conform"), { recursive: true });
    for (const s of spec.screens) await writeFile(path.join(dir, "src/screens", `${s.id}.tsx`), renderScreen(s, slotPicker(spec, s.id)));
    await writeFile(path.join(dir, "conform.config.json"), `${JSON.stringify({
      repo: `northgate/${spec.repo}`, bundle: ".conform/bundle.json", keys: ".conform/keys.json", styling: "tailwind", themeCss: ".conform/theme.css", css: [],
      screens: spec.screens.map((s) => ({ id: s.id, module: `src/screens/${s.id}.tsx` })),
    }, null, 2)}\n`);
    await cp(path.join(ROOT, "dist/bundle.json"), path.join(dir, ".conform/bundle.json"));
    await cp(path.join(ROOT, "dist/keys.json"), path.join(dir, ".conform/keys.json"));
    await cp(path.join(ROOT, "dist/lock.json"), path.join(dir, "conform.lock.json"));
    await cp(path.join(ROOT, "design-system/theme.css"), path.join(dir, ".conform/theme.css"));
  }
  console.log(`${SPECS.length} repositories, ${SPECS.reduce((n, s) => n + s.screens.length, 0)} screens`);
}
