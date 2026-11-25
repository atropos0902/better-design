export default function Keys() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Keys</h1>
      <section data-testid="list" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">All keys</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-xs font-medium text-slate-600 px-4 text-left">Key</th><th className="text-xs font-medium text-slate-600 px-4 text-left">Use</th><th className="text-xs font-medium text-slate-600 px-4 text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">sign-2</td>
              <td className="text-body px-medium text-primary">Signing</td>
              <td className="text-body px-medium text-primary"><span data-status="ok" className="text-caption font-medium rounded px-small py-tight text-ok">Healthy</span></td>
            </tr>
            <tr className="h-row border-b border-default">
              <td className="text-body px-medium text-primary">wrap-1</td>
              <td className="text-body px-medium text-primary">Wrapping</td>
              <td className="text-body px-medium text-primary"><span data-status="warn" className="text-caption font-medium rounded px-small py-tight text-warn">Needs attention</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Create key</button>
          <button type="button" data-testid="second-action" className="h-9 px-control rounded-control text-body font-medium bg-action-secondary text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Schedule deletion</button>
        </div>
      </section>
    </main>
  );
}
