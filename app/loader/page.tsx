import Link from "next/link";
import { SalesmanHandoffPicker } from "./SalesmanHandoffPicker";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-OM", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function LoaderDashboardPage() {
  const dayStart = startOfDay();

  const [salesmen, reconciliations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALESMAN", isActive: true },
      include: {
        salesmanReconciliations: {
          where: { reconciliationDate: dayStart },
          include: { items: true },
          orderBy: { morningLoggedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.dailyReconciliation.findMany({
      where: {
        reconciliationDate: dayStart,
      },
      include: {
        items: true,
      },
    }),
  ]);

  const todaysLoads = reconciliations.length;
  const pendingReturns = reconciliations.filter((item) => item.status !== "EVENING_RECONCILED").length;

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">Loader / Unloader</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Daily Route Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Select a salesman, record the hand-off, and close the route at the end of the day.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/loader" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
                Home
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Today&apos;s Loads</p>
            <div className="mt-2 text-4xl font-black text-slate-950">{formatNumber(todaysLoads)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Morning load hand-offs recorded today.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Pending Returns</p>
            <div className="mt-2 text-4xl font-black text-amber-700">{formatNumber(pendingReturns)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Routes still waiting for evening close-out.</p>
          </div>
        </section>

        <SalesmanHandoffPicker
          salesmen={salesmen.map((salesman) => ({
            id: salesman.id,
            fullName: salesman.fullName,
          }))}
        />

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-black text-slate-950">Salesman Queue</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">Waiting and on-route salesmen for quick hand-off.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Salesman</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {salesmen.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 font-bold text-slate-600" colSpan={3}>
                      No active salesmen are available.
                    </td>
                  </tr>
                ) : (
                  salesmen.map((salesman) => {
                    const route = salesman.salesmanReconciliations[0] ?? null;
                    const isOnRoute = Boolean(route && route.status !== "EVENING_RECONCILED");
                    const statusLabel = isOnRoute ? "On Route" : "Waiting";
                    const statusTone = isOnRoute ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";

                    return (
                      <tr key={salesman.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-black text-slate-950">{salesman.fullName}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-1 text-xs font-black uppercase ${statusTone}`}>{statusLabel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/loader/load/${salesman.id}`}
                              className="rounded bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                            >
                              Morning Load
                            </Link>
                            <Link
                              href={`/loader/return/${salesman.id}`}
                              className="rounded bg-amber-600 px-3 py-2 text-xs font-black text-white"
                            >
                              Evening Return
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
