import { gap, percent, RULE_NAMES, type DashboardData, type Stage } from "./data";

const CARD = "p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium overflow-x-auto";
const TH = "text-caption font-medium text-muted px-medium";
const TD = "text-body px-medium text-primary";
const CONTROL = "h-control px-control rounded-control text-body font-medium";
const STAGE_NAMES: Record<Stage, string> = { silent: "Silent", comments: "Comments", required: "Required" };

export interface Actions { onKillSwitch?: (on: boolean) => void; onStage?: (repo: number, stage: Stage) => void; busy?: boolean; error?: string | null }

export function Overview({ data, onKillSwitch, onStage, busy = false, error = null }: { data: DashboardData } & Actions) {
  const total = data.repos.reduce((t, r) => ({ decisions: t.decisions + r.decisions, bound: t.bound + r.bound, valueMatches: t.valueMatches + r.valueMatches }), { decisions: 0, bound: 0, valueMatches: 0 });
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-medium">
        <div className="flex flex-col gap-tight">
          <h1 className="text-title font-bold text-primary">Design system review</h1>
          <p className="text-body text-muted">
            {data.customer}: {total.decisions === 0 ? "no reviews yet" : `${percent(total.bound, total.decisions)} bound, ${percent(total.valueMatches, total.decisions)} by value`}
          </p>
        </div>
        {data.admin && (
          <button type="button" data-testid="kill-switch" aria-pressed={data.killSwitch} disabled={busy} onClick={() => onKillSwitch?.(!data.killSwitch)}
            className={data.killSwitch ? `${CONTROL} bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong` : `${CONTROL} bg-action-danger hover:bg-action-danger-hover text-on-action`}>
            {data.killSwitch ? "Turn enforcement on" : "Set all to comments"}
          </button>
        )}
      </header>
      {error && <p role="alert" className="text-body text-critical">{error}</p>}
      {data.killSwitch && <p data-status="warn" className="self-start text-caption font-medium text-warn border border-warn rounded-control px-small py-tight">Enforcement is off. Every repository gets comments only.</p>}

      <section className={CARD}>
        <h2 className="text-heading font-bold text-primary">Repositories</h2>
        {data.repos.length === 0 ? <p className="text-body text-muted">No repositories connected. Install the GitHub App on one to start.</p> : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${TH} text-left`}>Repository</th>
                <th className={`${TH} text-left`}>Stage</th>
                <th className={`${TH} text-right`}>Reviews</th>
                <th className={`${TH} text-right`}>Binding</th>
                <th className={`${TH} text-right`}>Value</th>
                <th className={`${TH} text-right`}>Value flatters by</th>
                <th className={`${TH} text-right`}>Unresolved</th>
              </tr>
            </thead>
            <tbody>
              {data.repos.map((r) => (
                <tr key={r.id} className="h-row border-b border-default">
                  <td className={TD}>{r.repo}</td>
                  <td className={TD}>
                    {data.admin ? (
                      <select aria-label={`Stage for ${r.repo}`} value={r.stage} disabled={busy} onChange={(e) => onStage?.(r.id, e.target.value as Stage)} className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong">
                        {(Object.keys(STAGE_NAMES) as Stage[]).map((s) => <option key={s} value={s}>{STAGE_NAMES[s]}</option>)}
                      </select>
                    ) : STAGE_NAMES[r.stage]}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{r.reviews}</td>
                  <td className={`${TD} text-right tabular-nums`}>{percent(r.bound, r.decisions)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{percent(r.valueMatches, r.decisions)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{gap(r)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{r.unresolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-large md:grid-cols-2">
        <section className={CARD}>
          <h2 className="text-heading font-bold text-primary">Rules that fire most</h2>
          {data.rules.length === 0 ? <p className="text-body text-muted">Nothing has been found yet.</p> : (
            <table className="w-full">
              <thead><tr><th className={`${TH} text-left`}>Rule</th><th className={`${TH} text-right`}>Findings</th></tr></thead>
              <tbody>{data.rules.map((r) => <tr key={r.rule} className="h-row border-b border-default"><td className={TD}>{RULE_NAMES[r.rule] ?? r.rule}</td><td className={`${TD} text-right tabular-nums`}>{r.count}</td></tr>)}</tbody>
            </table>
          )}
        </section>
        <section className={CARD}>
          <h2 className="text-heading font-bold text-primary">Open waivers</h2>
          {data.waivers.length === 0 ? <p className="text-body text-muted">No waivers are open.</p> : (
            <table className="w-full">
              <thead><tr><th className={`${TH} text-left`}>Rule</th><th className={`${TH} text-left`}>Property</th><th className={`${TH} text-right`}>Waived</th></tr></thead>
              <tbody>{data.waivers.map((w) => (
                <tr key={`${w.rule} ${w.prop}`} className="h-row border-b border-default">
                  <td className={TD}>{RULE_NAMES[w.rule] ?? w.rule}</td>
                  <td className={TD}>{w.prop}</td>
                  <td className={`${TD} text-right tabular-nums`}>{w.count}{w.question && <span data-status="warn" className="ml-small text-caption font-medium text-warn">Check the rule</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
