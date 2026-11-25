export default function Incidents() {
  return (
    <main className="bg-slate-100 p-8 flex flex-col gap-6 min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Incidents</h1>
      <section data-testid="list" className="p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">All incidents</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-medium text-muted px-medium text-left">Incident</th><th className="text-caption font-medium text-muted px-medium text-left">Lead</th><th className="text-caption font-medium text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-12 border-b border-slate-200">
              <td className="text-body px-4 text-primary">Login outage</td>
              <td className="text-body px-4 text-primary">SRE</td>
              <td className="text-body px-4 text-primary"><span data-status="critical" className="text-caption font-medium rounded px-small py-tight text-critical">Failing</span></td>
            </tr>
            <tr className="h-12 border-b border-slate-200">
              <td className="text-body px-4 text-primary">Slow search</td>
              <td className="text-body px-4 text-primary">Search</td>
              <td className="text-body px-4 text-primary"><span data-status="warn" className="text-caption font-medium rounded px-small py-tight text-warn">Needs attention</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-[10px]">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Open incident</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-red-600 text-on-action">Delete draft</button>
        </div>
      </section>
    </main>
  );
}
