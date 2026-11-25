export default function Policy() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-2xl font-bold text-slate-900">Rotation policy</h1>
      <section data-testid="form" className="p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">Policy settings</h2>
        <form className="flex flex-col gap-small">
          <label htmlFor="f0" className="text-caption font-medium text-muted">Lifetime</label>
          <input id="f0" data-testid="field-0" defaultValue="90" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f1" className="text-caption font-medium text-muted">Warning</label>
          <input id="f1" data-testid="field-1" defaultValue="14" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f2" className="text-caption font-medium text-muted">Owner</label>
          <input id="f2" data-testid="field-2" defaultValue="Edge" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
        </form>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-10 px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Save policy</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Reset</button>
        </div>
      </section>
    </main>
  );
}
