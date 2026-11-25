export default function Alert() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Alert detail</h1>
      <section data-testid="detail" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-lg font-bold text-slate-900">Impossible travel</h2>
        <p className="text-sm text-slate-500">Alert: Impossible travel</p>
        <p className="text-sm text-slate-500">Entity: user-118</p>
        <p className="text-sm text-slate-500">Severity: High</p>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="main-action" className="h-control px-4 rounded-control text-body font-medium bg-action-primary hover:bg-blue-700 text-on-action">Escalate</button>
          <button type="button" data-testid="second-action" className="h-9 px-control rounded-control text-body font-medium bg-action-secondary text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-red-600 text-on-action">Close alert</button>
        </div>
      </section>
    </main>
  );
}
