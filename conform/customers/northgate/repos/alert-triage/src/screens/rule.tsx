export default function Rule() {
  return (
    <main className="bg-slate-100 p-8 flex flex-col gap-6 min-h-screen">
      <h1 className="text-title font-semibold text-primary">Edit rule</h1>
      <section data-testid="form" className="p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">Rule settings</h2>
        <form className="flex flex-col gap-[10px]">
          <label htmlFor="f0" className="text-caption font-medium text-muted">Name</label>
          <input id="f0" data-testid="field-0" defaultValue="Failed logins" className="h-10 px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f1" className="text-caption font-medium text-muted">Threshold</label>
          <input id="f1" data-testid="field-1" defaultValue="20" className="h-10 px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f2" className="text-caption font-medium text-muted">Window</label>
          <input id="f2" data-testid="field-2" defaultValue="10m" className="h-10 px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
        </form>
        <div className="flex items-end gap-[10px]">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Save rule</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Delete rule</button>
        </div>
      </section>
    </main>
  );
}
