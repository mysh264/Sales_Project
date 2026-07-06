import Link from "next/link";
import { SalesmanHandoffPicker } from "./SalesmanHandoffPicker";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-OM", {
    maximumFractionDigits: 0,
  }).format(value);
}

function todayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function LoaderDashboardPage() {
  const dayStart = startOfDay();
  const dayEnd = endOfDay();

  const [salesmen, todayReconciliations, recentReconciliations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALESMAN", isActive: true },
      include: {
        branch: true,
        salesmanReconciliations: {
          where: { reconciliationDate: dayStart },
          include: {
            items: true,
          },
          orderBy: { morningLoggedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ branch: { name: "asc" } }, { fullName: "asc" }],
    }),
    prisma.dailyReconciliation.findMany({
      where: {
        reconciliationDate: dayStart,
      },
      include: {
        salesman: { select: { fullName: true } },
        branch: { select: { name: true } },
        items: true,
      },
      orderBy: [{ morningLoggedAt: "desc" }],
    }),
    prisma.dailyReconciliation.findMany({
      where: {
        morningLoggedAt: {
          gte: dayStart,
          lt: dayEnd,
        },
        status: "EVENING_RECONCILED",
      },
      include: {
        salesman: { select: { fullName: true } },
        branch: { select: { name: true } },
        items: true,
      },
      orderBy: [{ eveningReconciledAt: "desc" }],
      take: 5,
    }),
  ]);

  const activeSalesmenCount = salesmen.length;
  const activeRoutesCount = todayReconciliations.filter((item) => item.status !== "EVENING_RECONCILED").length;
  const completedRoutesCount = todayReconciliations.filter((item) => item.status === "EVENING_RECONCILED").length;
  const loadedRowsCount = todayReconciliations.reduce(
    (total, item) => total + item.items.reduce((sum, row) => sum + row.morningFull, 0),
    0,
  );

  const branchStatsMap = salesmen.reduce(
    (map, salesman) => {
      const branchKey = salesman.branch?.name ?? "Unassigned";
      const current = map.get(branchKey) ?? {
        branchName: branchKey,
        activeSalesmen: 0,
        openRoutes: 0,
        completedRoutes: 0,
      };

      current.activeSalesmen += 1;
      if (salesman.salesmanReconciliations[0]?.status === "MORNING_RECORDED") {
        current.openRoutes += 1;
      }
      if (salesman.salesmanReconciliations[0]?.status === "EVENING_RECONCILED") {
        current.completedRoutes += 1;
      }

      map.set(branchKey, current);
      return map;
    },
    new Map<string, { branchName: string; activeSalesmen: number; openRoutes: number; completedRoutes: number }>(),
  );

  const branchStats = Array.from(branchStatsMap.values()).sort((left, right) =>
    left.branchName.localeCompare(right.branchName),
  );

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">Loader / Unloader</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Daily Route Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Select a salesman, hand off the morning load, and close the route at the end of the day.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/loader" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
                Home
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Active Salesmen</p>
            <div className="mt-2 text-4xl font-black text-slate-950">{formatNumber(activeSalesmenCount)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Salesmen available for hand-off today.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Morning Loads Today</p>
            <div className="mt-2 text-4xl font-black text-emerald-700">{formatNumber(loadedRowsCount)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Loaded cylinder lines recorded today.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Active Routes</p>
            <div className="mt-2 text-4xl font-black text-amber-700">{formatNumber(activeRoutesCount)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Routes waiting for evening close-out.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Completed Today</p>
            <div className="mt-2 text-4xl font-black text-sky-700">{formatNumber(completedRoutesCount)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Routes fully reconciled since midnight.</p>
          </div>
        </section>

        <SalesmanHandoffPicker
          salesmen={salesmen.map((salesman) => ({
            id: salesman.id,
            fullName: salesman.fullName,
            branchName: salesman.branch?.name ?? null,
          }))}
        />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-black text-slate-950">Active Routes by Branch</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">Salesmen and their current route state.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Active Salesmen</th>
                    <th className="px-4 py-3">Open Routes</th>
                    <th className="px-4 py-3">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {branchStats.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 font-bold text-slate-600" colSpan={4}>
                        No salesmen are configured yet.
                      </td>
                    </tr>
                  ) : (
                    branchStats.map((branch) => (
                      <tr key={branch.branchName} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-black text-slate-950">{branch.branchName}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{formatNumber(branch.activeSalesmen)}</td>
                        <td className="px-4 py-3 font-bold text-amber-700">{formatNumber(branch.openRoutes)}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{formatNumber(branch.completedRoutes)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Recent Route Closures</h2>
                <p className="mt-1 text-sm font-bold text-slate-600">Latest completed hand-offs for quick checking.</p>
              </div>
              <Link href="/finance/reconciliation-overview" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900">
                Finance View
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {recentReconciliations.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-600">No completed routes yet today.</p>
              ) : (
                recentReconciliations.map((reconciliation) => (
                  <div key={reconciliation.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{reconciliation.salesman.fullName}</p>
                        <p className="text-xs font-bold text-slate-500">{reconciliation.branch?.name ?? "Unassigned branch"}</p>
                      </div>
                      <span className="text-xs font-black uppercase text-emerald-700">{reconciliation.items.length} rows</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Closed on {todayKey(reconciliation.eveningReconciledAt ?? reconciliation.morningLoggedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-black text-slate-950">Salesman Queue</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">Choose the next salesman to hand off or close out.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Salesman</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Route Status</th>
                  <th className="px-4 py-3">Loaded Rows</th>
                  <th className="px-4 py-3">Closed</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {salesmen.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 font-bold text-slate-600" colSpan={6}>
                      No active salesmen are available.
                    </td>
                  </tr>
                ) : (
                  salesmen.map((salesman) => {
                    const route = salesman.salesmanReconciliations[0] ?? null;
                    const routeStatus =
                      route?.status === "EVENING_RECONCILED"
                        ? "Closed"
                        : route?.status === "MORNING_RECORDED"
                          ? "Open"
                          : "Waiting";
                    const loadedRows = route?.items.reduce((total, item) => total + item.morningFull, 0) ?? 0;

                    return (
                      <tr key={salesman.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-black text-slate-950">{salesman.fullName}</div>
                          <div className="text-xs font-bold text-slate-500">Salesman hand-off</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{salesman.branch?.name ?? "Unassigned"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-1 text-xs font-black uppercase ${
                              routeStatus === "Closed"
                                ? "bg-emerald-100 text-emerald-800"
                                : routeStatus === "Open"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {routeStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{formatNumber(loadedRows)}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {route?.eveningReconciledAt ? route.eveningReconciledAt.toLocaleDateString("en-GB") : "—"}
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
