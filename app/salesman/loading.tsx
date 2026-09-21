export default function SalesmanLoading() {
  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-6" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-24 rounded-2xl bg-slate-200/80" />
        <div className="h-40 rounded-2xl bg-slate-200/70" />
        <div className="h-40 rounded-2xl bg-slate-200/70" />
      </div>
      <p className="sr-only">Loading salesman workspace…</p>
    </main>
  );
}
