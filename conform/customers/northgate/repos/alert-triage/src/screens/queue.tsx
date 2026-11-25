export default function Queue() {
  return (
    <main className="bg-surface-page p-8 flex flex-col gap-large min-h-screen">
      <h1 className="text-2xl font-bold text-slate-900">Alert queue</h1>
      <section data-testid="list" className="p-6 rounded-lg bg-white border border-slate-200 shadow flex flex-col gap-4">
        <h2 className="text-heading font-bold text-primary">All alerts</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-bold text-muted px-medium text-left">Alert</th><th className="text-caption font-bold text-muted px-medium text-left">Source</th><th className="text-caption font-bold text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">Impossible travel</td>
              <td className="text-body px-medium text-primary">SSO</td>
              <td className="text-body px-medium text-primary"><span data-status="critical" className="text-caption font-medium rounded-control px-small py-tight text-critical">Failing</span></td>
            </tr>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">New admin</td>
              <td className="text-body px-medium text-primary">Directory</td>
              <td className="text-body px-medium text-primary"><span data-status="warn" className="text-caption font-medium rounded-control px-small py-tight text-warn">Needs attention</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-10 px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Assign to me</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-10 px-4 rounded-md text-sm font-medium bg-red-600 text-white">Dismiss</button>
        </div>
      </section>
    </main>
  );
}
