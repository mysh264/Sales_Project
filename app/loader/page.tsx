import Link from "next/link";
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

export default async function LoaderDashboardPage() {
  const dayStart = startOfDay();
  const dayEnd = endOfDay();

  const [trucks, activeSessionCount, todayLoadedCount, todayReturnedCount, todaySessions, recentSessions] =
    await Promise.all([
      prisma.truck.findMany({
        include: {
          branch: true,
          salesman: true,
          sessions: {
            where: { returnedAt: null },
            orderBy: { loadedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { plateNumber: "asc" },
      }),
      prisma.truckLoadSession.count({
        where: { returnedAt: null },
      }),
      prisma.truckLoadSession.count({
        where: {
          loadedAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      }),
      prisma.truckLoadSession.count({
        where: {
          returnedAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      }),
      prisma.truckLoadSession.findMany({
        where: {
          loadedAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        include: {
          truck: {
            select: { plateNumber: true },
          },
          salesman: {
            select: { fullName: true },
          },
          loader: {
            select: { fullName: true },
          },
        },
        orderBy: { loadedAt: "desc" },
        take: 5,
      }),
      prisma.truckLoadSession.findMany({
        where: { returnedAt: null },
        include: {
          truck: {
            select: { plateNumber: true, branch: { select: { name: true } } },
          },
          salesman: {
            select: { fullName: true },
          },
          loader: {
            select: { fullName: true },
          },
        },
        orderBy: { loadedAt: "asc" },
        take: 6,
      }),
    ]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">Loader / Unloader</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Truck Operations Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Use this screen to start morning loads, finish evening returns, and see what is still open today.
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
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Open Sessions</p>
            <div className="mt-2 text-4xl font-black text-slate-950">{formatNumber(activeSessionCount)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Trucks still on the road or waiting to return.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Morning Loads Today</p>
            <div className="mt-2 text-4xl font-black text-emerald-700">{formatNumber(todayLoadedCount)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Sessions started since midnight.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Evening Returns Today</p>
            <div className="mt-2 text-4xl font-black text-amber-700">{formatNumber(todayReturnedCount)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">Returns closed during the current day.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ready Trucks</p>
            <div className="mt-2 text-4xl font-black text-sky-700">{formatNumber(trucks.length)}</div>
            <p className="mt-2 text-sm font-bold text-slate-600">All configured trucks in the system.</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-black text-slate-950">Truck Queue</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">Choose a truck and go straight to morning load or evening return.</p>
            </div>
            {trucks.length === 0 ? (
              <div className="p-5 text-sm font-bold text-slate-600">No trucks are configured yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Truck</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">Salesman</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {trucks.map((truck) => {
                      const activeSession = truck.sessions[0];

                      return (
                        <tr key={truck.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-black text-slate-950">{truck.plateNumber}</div>
                            <div className="text-xs font-bold text-slate-500">{truck.label ?? "No label"}</div>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">{truck.branch?.name ?? "Unassigned"}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{truck.salesman?.fullName ?? "No salesman"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-2 py-1 text-xs font-black uppercase ${
                                activeSession ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {activeSession ? "Open Load" : "Ready"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {activeSession ? (
                                <Link
                                  href={`/loader/return/${activeSession.id}`}
                                  className="rounded bg-amber-600 px-4 py-2 text-xs font-black text-white"
                                >
                                  Evening Return
                                </Link>
                              ) : (
                                <Link
                                  href={`/loader/load/${truck.id}`}
                                  className="rounded bg-emerald-700 px-4 py-2 text-xs font-black text-white"
                                >
                                  Morning Load
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Today’s Work</h2>
                  <p className="mt-1 text-sm font-bold text-slate-600">Recent load sessions started or returned today.</p>
                </div>
                <Link href="/logistics/reconciliation" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900">
                  Reconciliation
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {todaySessions.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-600">No sessions started today yet.</p>
                ) : (
                  todaySessions.map((session) => (
                    <div key={session.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-950">{session.truck.plateNumber}</p>
                          <p className="text-xs font-bold text-slate-500">
                            {session.salesman.fullName} · Loader: {session.loader.fullName}
                          </p>
                        </div>
                        <span className="text-xs font-black uppercase text-slate-500">
                          {session.returnedAt ? "Returned" : "Open"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold text-slate-500">
                        Loaded at {session.loadedAt.toLocaleString("en-GB")}
                        {session.returnedAt ? ` · Returned at ${session.returnedAt.toLocaleString("en-GB")}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Open Sessions</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">These trucks still need an evening return.</p>
              <div className="mt-4 space-y-3">
                {recentSessions.length === 0 ? (
                  <p className="rounded-lg bg-emerald-50 p-4 text-sm font-bold text-emerald-800">No open sessions right now.</p>
                ) : (
                  recentSessions.map((session) => (
                    <div key={session.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-950">{session.truck.plateNumber}</p>
                          <p className="text-xs font-bold text-slate-500">
                            {session.truck.branch?.name ?? "No branch"} · {session.salesman.fullName}
                          </p>
                        </div>
                        <Link
                          href={`/loader/return/${session.id}`}
                          className="rounded bg-safety px-3 py-2 text-xs font-black text-white"
                        >
                          Return
                        </Link>
                      </div>
                      <p className="mt-2 text-xs font-bold text-slate-500">
                        Loaded {session.loadedAt.toLocaleDateString("en-GB")} at {session.loadedAt.toLocaleTimeString("en-GB")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
