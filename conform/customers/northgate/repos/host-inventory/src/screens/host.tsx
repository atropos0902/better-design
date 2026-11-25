export default function Host() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Host detail</h1>
      <section data-testid="detail" className="p-6 rounded-lg bg-white border border-slate-200 shadow flex flex-col gap-4">
        <h2 className="text-heading font-medium text-primary">web-001</h2>
        <p className="text-sm text-muted">Host: web-001</p>
        <p className="text-sm text-muted">Kernel: 6.8</p>
        <p className="text-sm text-muted">Owner: Web</p>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-10 px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Drain host</button>
          <button type="button" data-testid="second-action" className="h-control px-control rounded-control text-body font-medium bg-action-secondary hover:bg-action-secondary-hover text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Retire host</button>
        </div>
      </section>
    </main>
  );
}
