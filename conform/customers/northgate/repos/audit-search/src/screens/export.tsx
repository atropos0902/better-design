export default function Export() {
  return (
    <main className="bg-surface-page p-8 flex flex-col gap-large min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Export events</h1>
      <section data-testid="form" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-medium text-primary">Export settings</h2>
        <form className="flex flex-col gap-2">
          <label htmlFor="f0" className="text-caption font-medium text-muted">Range</label>
          <input id="f0" data-testid="field-0" defaultValue="7 days" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f1" className="text-caption font-medium text-muted">Format</label>
          <input id="f1" data-testid="field-1" defaultValue="CSV" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f2" className="text-caption font-medium text-muted">Reason</label>
          <input id="f2" data-testid="field-2" defaultValue="Legal" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
        </form>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Start export</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-red-600 text-on-action">Cancel</button>
        </div>
      </section>
    </main>
  );
}
