export default function Jobs() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Scan jobs</h1>
      <section data-testid="list" className="p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">All jobs</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-bold text-muted px-medium text-left">Job</th><th className="text-caption font-bold text-muted px-medium text-left">Target</th><th className="text-caption font-bold text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-4 text-primary">Nightly</td>
              <td className="text-body px-4 text-primary">All hosts</td>
              <td className="text-body px-4 text-primary"><span data-status="ok" className="text-xs font-medium rounded px-2 py-1 text-ok">Healthy</span></td>
            </tr>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-4 text-primary">Weekly deep</td>
              <td className="text-body px-4 text-primary">Edge</td>
              <td className="text-body px-4 text-primary"><span data-status="warn" className="text-xs font-medium rounded px-2 py-1 text-warn">Needs attention</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Run scan</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-10 px-4 rounded-md text-sm font-medium bg-red-600 text-white">Stop scan</button>
        </div>
      </section>
    </main>
  );
}
