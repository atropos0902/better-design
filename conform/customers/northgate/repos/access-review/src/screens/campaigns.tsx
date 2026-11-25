export default function Campaigns() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Access campaigns</h1>
      <section data-testid="list" className="p-6 rounded-lg bg-white border border-slate-200 shadow flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">All campaigns</h2>
        <table className="w-full">
          <thead>
            <tr><th className="text-caption font-bold text-muted px-medium text-left">Campaign</th><th className="text-caption font-bold text-muted px-medium text-left">Owner</th><th className="text-caption font-bold text-muted px-medium text-left">Status</th></tr>
          </thead>
          <tbody>
            <tr className="h-12 border-b border-slate-200">
              <td className="text-sm px-4 text-slate-900">Contractors</td>
              <td className="text-sm px-4 text-slate-900">IAM team</td>
              <td className="text-sm px-4 text-slate-900"><span data-status="ok" className="text-caption font-medium rounded-control px-small py-tight text-ok">Healthy</span></td>
            </tr>
            <tr className="h-12 border-b border-slate-200">
              <td className="text-sm px-4 text-slate-900">Admin roles</td>
              <td className="text-sm px-4 text-slate-900">Platform</td>
              <td className="text-sm px-4 text-slate-900"><span data-status="warn" className="text-caption font-medium rounded-control px-small py-tight text-warn">Needs attention</span></td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="main-action" className="h-10 px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Start campaign</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Cancel campaign</button>
        </div>
      </section>
    </main>
  );
}
