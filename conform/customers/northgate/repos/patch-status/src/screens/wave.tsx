export default function Wave() {
  return (
    <main className="bg-surface-page p-section flex flex-col gap-large min-h-screen">
      <h1 className="text-title font-bold text-primary">Rollout wave</h1>
      <section data-testid="detail" className="p-card rounded-card bg-surface-raised border border-default shadow-raised flex flex-col gap-medium">
        <h2 className="text-heading font-bold text-primary">2</h2>
        <p className="text-sm text-slate-500">Wave: 2</p>
        <p className="text-sm text-slate-500">Hosts: 120</p>
        <p className="text-sm text-slate-500">Health: Good</p>
        <div className="flex items-end gap-small">
          <button type="button" data-testid="main-action" className="h-10 px-4 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">Advance wave</button>
          <button type="button" data-testid="second-action" className="h-9 px-control rounded-control text-body font-medium bg-action-secondary text-primary border border-strong">Export</button>
          <button type="button" data-testid="danger-action" className="h-control px-control rounded-control text-body font-medium bg-red-600 text-on-action">Roll back</button>
        </div>
      </section>
    </main>
  );
}
