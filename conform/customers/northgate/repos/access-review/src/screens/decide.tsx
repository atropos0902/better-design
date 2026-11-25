export default function Decide() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Review a grant</h1>
      <section data-testid="detail" className="p-6 rounded-lg bg-white border border-slate-200 shadow flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">prod-read</h2>
        <p className="text-body text-muted">Grant: prod-read</p>
        <p className="text-body text-muted">Reason: On-call</p>
        <p className="text-body text-muted">Approver: Lead</p>
        <div className="flex items-end gap-[10px]">
          <button type="button" data-testid="main-action" className="h-10 px-control rounded-control text-body font-medium bg-action-primary hover:bg-action-primary-hover text-on-action">Keep access</button>
          <button type="button" data-testid="second-action" className="h-9 px-control rounded-control text-body font-medium bg-action-secondary text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-action-danger hover:bg-action-danger-hover text-on-action">Revoke access</button>
        </div>
      </section>
    </main>
  );
}
