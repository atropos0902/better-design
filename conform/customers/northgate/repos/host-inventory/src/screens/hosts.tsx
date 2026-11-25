export default function Hosts() {
  return (
    <main className="bg-surface-page p-8 flex flex-col gap-large min-h-screen">
      <h1 className="text-2xl font-bold text-slate-900">Hosts</h1>
      <section data-testid="list" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-medium text-primary">All hosts</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-bold text-muted px-medium text-left">Host</th><th className="text-caption font-bold text-muted px-medium text-left">Pool</th><th className="text-caption font-bold text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-4 text-primary">web-001</td>
              <td className="text-body px-4 text-primary">web</td>
              <td className="text-body px-4 text-primary"><span data-status="ok" className="text-xs font-medium rounded px-2 py-1 text-ok">Healthy</span></td>
            </tr>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-4 text-primary">web-002</td>
              <td className="text-body px-4 text-primary">web</td>
              <td className="text-body px-4 text-primary"><span data-status="critical" className="text-xs font-medium rounded px-2 py-1 text-critical">Failing</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-[10px]">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Add host</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-10 px-4 rounded-md text-sm font-medium bg-red-600 text-white">Retire host</button>
        </div>
      </section>
    </main>
  );
}
