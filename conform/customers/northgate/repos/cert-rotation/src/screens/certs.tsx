export default function Certs() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Certificates</h1>
      <section data-testid="list" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">All certificates</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-medium text-muted px-medium text-left">Host</th><th className="text-caption font-medium text-muted px-medium text-left">Issuer</th><th className="text-caption font-medium text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">edge-1</td>
              <td className="text-body px-medium text-primary">Internal CA</td>
              <td className="text-body px-medium text-primary"><span data-status="ok" className="text-xs font-medium rounded px-2 py-1 text-ok">Healthy</span></td>
            </tr>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">edge-2</td>
              <td className="text-body px-medium text-primary">Internal CA</td>
              <td className="text-body px-medium text-primary"><span data-status="critical" className="text-xs font-medium rounded px-2 py-1 text-critical">Failing</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-[10px]">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Rotate now</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-10 px-4 rounded-md text-sm font-medium bg-red-600 text-white">Revoke</button>
        </div>
      </section>
    </main>
  );
}
