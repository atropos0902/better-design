export default function Patches() {
  return (
    <main className="bg-slate-100 p-8 flex flex-col gap-6 min-h-screen">
      <h1 className="text-title font-bold text-primary">Patch status</h1>
      <section data-testid="list" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">All patchs</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-xs font-medium text-slate-600 px-4 text-left">Package</th><th className="text-xs font-medium text-slate-600 px-4 text-left">Hosts</th><th className="text-xs font-medium text-slate-600 px-4 text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-medium text-primary">openssl</td>
              <td className="text-body px-medium text-primary">412</td>
              <td className="text-body px-medium text-primary"><span data-status="warn" className="text-caption font-medium rounded-control px-small py-tight text-warn">Needs attention</span></td>
            </tr>
            <tr className="h-12 border-b border-default">
              <td className="text-body px-medium text-primary">glibc</td>
              <td className="text-body px-medium text-primary">88</td>
              <td className="text-body px-medium text-primary"><span data-status="critical" className="text-caption font-medium rounded-control px-small py-tight text-critical">Failing</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Start rollout</button>
          <button type="button" data-testid="second-action" className="h-9 px-control rounded-control text-body font-medium bg-action-secondary text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Pause rollout</button>
        </div>
      </section>
    </main>
  );
}
