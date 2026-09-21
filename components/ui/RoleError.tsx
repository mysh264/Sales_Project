"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

export function RoleError({
  homeHref,
  message,
  reset,
}: {
  homeHref: string;
  message?: string;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-6">
      <section className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-soft" role="alert">
        <h1 className="text-xl font-black text-slate-950">Something went wrong</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          {message || "This workspace failed to load."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <ButtonLink href={homeHref} variant="secondary">
            Back to home
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
