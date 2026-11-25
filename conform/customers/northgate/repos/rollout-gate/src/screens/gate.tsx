export default function Gate() {
  return (
    <main className="bg-surface-page p-8 flex flex-col gap-large min-h-screen">
      <h1 className="text-[24px] font-bold text-primary">Gate detail</h1>
      <section data-testid="detail" className="p-6 rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-4">
        <h2 className="text-heading font-bold text-primary">feed-api</h2>
        <p className="text-sm text-slate-500">Service: feed-api</p>
        <p className="text-sm text-slate-500">Error rate: 0.4%</p>
        <p className="text-sm text-slate-500">Owner: Feed</p>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-control px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Promote</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Roll back</button>
        </div>
      </section>
    </main>
  );
}
