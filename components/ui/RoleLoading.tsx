import { Skeleton } from "@/components/ui/skeleton";

export default function RoleLoading() {
  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-6" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
      <p className="sr-only">Loading workspace…</p>
    </main>
  );
}
