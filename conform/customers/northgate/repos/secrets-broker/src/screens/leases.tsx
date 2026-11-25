export default function Leases() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Active leases</h1>
      <section data-testid="list" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">All leases</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-bold text-muted px-medium text-left">Secret</th><th className="text-caption font-bold text-muted px-medium text-left">Holder</th><th className="text-caption font-bold text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">db/reports</td>
              <td className="text-body px-medium text-primary">batch-7</td>
              <td className="text-body px-medium text-primary"><span data-status="ok" className="text-caption font-medium rounded-control px-small py-tight text-ok">Healthy</span></td>
            </tr>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">db/ledger</td>
              <td className="text-body px-medium text-primary">api-2</td>
              <td className="text-body px-medium text-primary"><span data-status="warn" className="text-caption font-medium rounded-control px-small py-tight text-warn">Needs attention</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Issue lease</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Revoke lease</button>
        </div>
      </section>
    </main>
  );
}
