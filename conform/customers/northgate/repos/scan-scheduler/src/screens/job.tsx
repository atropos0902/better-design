export default function Job() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Schedule a scan</h1>
      <section data-testid="form" className="p-6 rounded-lg bg-white border border-slate-200 shadow flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">Scan settings</h2>
        <form className="flex flex-col gap-[10px]">
          <label htmlFor="f0" className="text-sm font-medium text-muted">Target</label>
          <input id="f0" data-testid="field-0" defaultValue="Edge" className="h-10 px-3 rounded-md text-sm bg-white text-slate-900 border border-slate-500" />
          <label htmlFor="f1" className="text-sm font-medium text-muted">Profile</label>
          <input id="f1" data-testid="field-1" defaultValue="Deep" className="h-10 px-3 rounded-md text-sm bg-white text-slate-900 border border-slate-500" />
          <label htmlFor="f2" className="text-sm font-medium text-muted">Window</label>
          <input id="f2" data-testid="field-2" defaultValue="02:00" className="h-10 px-3 rounded-md text-sm bg-white text-slate-900 border border-slate-500" />
        </form>
        <div className="flex items-end gap-[10px]">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Schedule</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Discard</button>
        </div>
      </section>
    </main>
  );
}
