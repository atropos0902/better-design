export default function Update() {
  return (
    <main className="bg-surface-page p-8 flex flex-col gap-large min-h-screen">
      <h1 className="text-2xl font-bold text-slate-900">Post an update</h1>
      <section data-testid="form" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">Update settings</h2>
        <form className="flex flex-col gap-2">
          <label htmlFor="f0" className="text-xs font-medium text-slate-600">Headline</label>
          <input id="f0" data-testid="field-0" defaultValue="Mitigated" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f1" className="text-xs font-medium text-slate-600">Impact</label>
          <input id="f1" data-testid="field-1" defaultValue="None" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
          <label htmlFor="f2" className="text-xs font-medium text-slate-600">Next step</label>
          <input id="f2" data-testid="field-2" defaultValue="Review" className="h-control px-control rounded-control text-body bg-surface-raised text-primary border border-strong" />
        </form>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Post update</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Discard</button>
        </div>
      </section>
    </main>
  );
}
