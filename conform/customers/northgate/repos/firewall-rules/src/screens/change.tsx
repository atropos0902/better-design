export default function Change() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-2xl font-bold text-slate-900">Change request</h1>
      <section data-testid="detail" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-medium text-primary">allow-dns</h2>
        <p className="text-sm text-muted">Rule: allow-dns</p>
        <p className="text-sm text-muted">Requester: Net</p>
        <p className="text-sm text-muted">Window: Sunday</p>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Approve</button>
          <button type="button" data-testid="second-action" className="h-10 px-4 rounded-md text-sm font-medium bg-white text-slate-900 border border-slate-500">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Reject</button>
        </div>
      </section>
    </main>
  );
}
