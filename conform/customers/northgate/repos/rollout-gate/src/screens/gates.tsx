export default function Gates() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Rollout gates</h1>
      <section data-testid="list" className="p-6 rounded-lg bg-white border border-slate-200 shadow flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">All gates</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-bold text-muted px-medium text-left">Service</th><th className="text-caption font-bold text-muted px-medium text-left">Stage</th><th className="text-caption font-bold text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-4 text-primary">search-api</td>
              <td className="text-body px-4 text-primary">Canary</td>
              <td className="text-body px-4 text-primary"><span data-status="ok" className="text-xs font-medium rounded px-2 py-1 text-ok">Healthy</span></td>
            </tr>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-4 text-primary">feed-api</td>
              <td className="text-body px-4 text-primary">Region 1</td>
              <td className="text-body px-4 text-primary"><span data-status="warn" className="text-xs font-medium rounded px-2 py-1 text-warn">Needs attention</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Open gate</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Close gate</button>
        </div>
      </section>
    </main>
  );
}
