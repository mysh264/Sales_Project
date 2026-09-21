"use client";

import Link from "next/link";

export default function SalesmanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-6">
      <section className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm" role="alert">
        <h1 className="text-xl font-black text-slate-950">Something went wrong</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          {error.message || "The salesman workspace failed to load."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="ui-btn ui-btn-primary min-h-12 px-5">
            Try again
          </button>
          <Link href="/salesman" className="ui-btn ui-btn-secondary min-h-12 px-5">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
