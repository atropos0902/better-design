export default function Rules() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Firewall rules</h1>
      <section data-testid="list" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">All rules</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-medium text-muted px-medium text-left">Rule</th><th className="text-caption font-medium text-muted px-medium text-left">Zone</th><th className="text-caption font-medium text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-12 border-b border-slate-200">
              <td className="text-body px-medium text-primary">allow-https</td>
              <td className="text-body px-medium text-primary">edge</td>
              <td className="text-body px-medium text-primary"><span data-status="ok" className="text-xs font-medium rounded px-2 py-1 text-ok">Healthy</span></td>
            </tr>
            <tr className="h-12 border-b border-slate-200">
              <td className="text-body px-medium text-primary">deny-smb</td>
              <td className="text-body px-medium text-primary">core</td>
              <td className="text-body px-medium text-primary"><span data-status="ok" className="text-xs font-medium rounded px-2 py-1 text-ok">Healthy</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-control px-4 rounded-control text-body font-medium bg-action-primary hover:bg-blue-700 text-on-action">Add rule</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Disable rule</button>
        </div>
      </section>
    </main>
  );
}
