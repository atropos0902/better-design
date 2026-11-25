export default function Rotate() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Rotate a key</h1>
      <section data-testid="form" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">Key settings</h2>
        <form className="flex flex-col gap-2">
          <label htmlFor="f0" className="text-caption font-medium text-muted">Key</label>
          <input id="f0" data-testid="field-0" defaultValue="sign-2" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f1" className="text-caption font-medium text-muted">Version</label>
          <input id="f1" data-testid="field-1" defaultValue="4" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f2" className="text-caption font-medium text-muted">Reason</label>
          <input id="f2" data-testid="field-2" defaultValue="Schedule" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
        </form>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Rotate key</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-red-600 text-on-action">Cancel</button>
        </div>
      </section>
    </main>
  );
}
