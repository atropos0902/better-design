export default function Search() {
  return (
    <main className="bg-surface-page p-8 flex flex-col gap-large min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Audit search</h1>
      <section data-testid="list" className="p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4">
        <h2 className="text-heading font-bold text-primary">All events</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-bold text-muted px-medium text-left">Event</th><th className="text-caption font-bold text-muted px-medium text-left">Actor</th><th className="text-caption font-bold text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">role.grant</td>
              <td className="text-body px-medium text-primary">svc-iam</td>
              <td className="text-body px-medium text-primary"><span data-status="ok" className="text-xs font-medium rounded px-2 py-1 text-ok">Healthy</span></td>
            </tr>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">key.export</td>
              <td className="text-body px-medium text-primary">user-52</td>
              <td className="text-body px-medium text-primary"><span data-status="critical" className="text-xs font-medium rounded px-2 py-1 text-critical">Failing</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Search</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Clear filters</button>
        </div>
      </section>
    </main>
  );
}
