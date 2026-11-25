export default function Issue() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Issue a lease</h1>
      <section data-testid="form" className="p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">Lease settings</h2>
        <form className="flex flex-col gap-small">
          <label htmlFor="f0" className="text-caption font-medium text-muted">Secret</label>
          <input id="f0" data-testid="field-0" defaultValue="db/reports" className="h-10 px-3 rounded-md text-sm bg-white text-slate-900 border border-slate-500" />
          <label htmlFor="f1" className="text-caption font-medium text-muted">Purpose</label>
          <input id="f1" data-testid="field-1" defaultValue="Backfill" className="h-10 px-3 rounded-md text-sm bg-white text-slate-900 border border-slate-500" />
          <label htmlFor="f2" className="text-caption font-medium text-muted">Duration</label>
          <input id="f2" data-testid="field-2" defaultValue="1h" className="h-10 px-3 rounded-md text-sm bg-white text-slate-900 border border-slate-500" />
        </form>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Issue</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Clear</button>
        </div>
      </section>
    </main>
  );
}
