import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateDMY } from "@/lib/date-format";
import { Permissions } from "@/lib/permissions";
import { checkPermission, requirePermission } from "@/lib/permission-guard";
import { getCurrentUser } from "@/lib/session";
import { hasGlobalSalesAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OverviewSearchParams = {
  start?: string;
  end?: string;
};

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function endOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nextDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function dayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-OM", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ReconciliationOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<OverviewSearchParams>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN" && !checkPermission(currentUser, Permissions.Finance_Read)) {
    await requirePermission(Permissions.Finance_Read);
  }

  const params = (await searchParams) ?? {};
  const startDate = parseDate(params.start) ?? startOfMonth();
  const endDateInput = parseDate(params.end);
  const endDateExclusive = endDateInput ? nextDay(endDateInput) : endOfMonth();
  const endDateDisplay = endDateInput ?? new Date(endDateExclusive.getFullYear(), endDateExclusive.getMonth(), endDateExclusive.getDate() - 1);
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const branchScope = hasGlobalAccess
    ? {}
    : currentUser.branchId
      ? { branchId: currentUser.branchId }
      : { branchId: "__no_branch__" };

  const [reconciliations, invoices] = await Promise.all([
    prisma.dailyReconciliation.findMany({
      where: {
        reconciliationDate: {
          gte: startDate,
          lt: endDateExclusive,
        },
        ...branchScope,
      },
      include: {
        salesman: {
          select: { fullName: true },
        },
        branch: {
          select: { name: true },
        },
        items: true,
      },
      orderBy: [{ reconciliationDate: "desc" }, { morningLoggedAt: "desc" }],
    }),
    prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDateExclusive,
        },
        ...branchScope,
      },
      select: {
        salesmanId: true,
        createdAt: true,
        items: {
          select: {
            fullCylindersDelivered: true,
          },
        },
      },
    }),
  ]);

  const invoicedMap = new Map<string, number>();
  for (const invoice of invoices) {
    const key = `${invoice.salesmanId}:${dayKey(invoice.createdAt)}`;
    const current = invoicedMap.get(key) ?? 0;
    const invoiceTotal = invoice.items.reduce((total, item) => total + item.fullCylindersDelivered, 0);
    invoicedMap.set(key, current + invoiceTotal);
  }

  const rows = reconciliations.map((reconciliation) => {
    const totalLoaded = reconciliation.items.reduce((total, item) => total + item.morningFull, 0);
    const returnedFull = reconciliation.items.reduce((total, item) => total + item.eveningReturnedFull, 0);
    const returnedEmpty = reconciliation.items.reduce((total, item) => total + item.eveningReturnedEmpty, 0);
    const calculatedSold = totalLoaded - returnedFull;
    const actualInvoiced = invoicedMap.get(`${reconciliation.salesmanId}:${dayKey(reconciliation.reconciliationDate)}`) ?? 0;
    const variance = actualInvoiced - calculatedSold;

    return {
      id: reconciliation.id,
      date: reconciliation.reconciliationDate,
      salesman: reconciliation.salesman.fullName,
      branch: reconciliation.branch?.name ?? "Unassigned",
      totalLoaded,
      returnedFull,
      returnedEmpty,
      calculatedSold,
      actualInvoiced,
      variance,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.loaded += row.totalLoaded;
      acc.returnedFull += row.returnedFull;
      acc.returnedEmpty += row.returnedEmpty;
      acc.calculatedSold += row.calculatedSold;
      acc.actualInvoiced += row.actualInvoiced;
      acc.variance += row.variance;
      return acc;
    },
    { loaded: 0, returnedFull: 0, returnedEmpty: 0, calculatedSold: 0, actualInvoiced: 0, variance: 0 },
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">Finance / Reconciliation Overview</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Loader to Invoice Hand-off</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Compare what the loader recorded against what the salesman invoiced. Use this to spot missing sales or route variance.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/manager" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
                Back to Manager
              </Link>
              <Link href="/loader" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Loader Dashboard
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Total Loaded</p>
            <div className="mt-2 text-4xl font-black text-slate-950">{formatNumber(totals.loaded)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Returned Full</p>
            <div className="mt-2 text-4xl font-black text-amber-700">{formatNumber(totals.returnedFull)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Actual Invoiced</p>
            <div className="mt-2 text-4xl font-black text-emerald-700">{formatNumber(totals.actualInvoiced)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Variance</p>
            <div className={`mt-2 text-4xl font-black ${totals.variance === 0 ? "text-slate-950" : "text-red-700"}`}>
              {formatNumber(totals.variance)}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-black text-slate-950">Daily Comparison</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Date range: {formatDateDMY(startDate)} to {formatDateDMY(endDateDisplay)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Salesman</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Total Loaded</th>
                  <th className="px-4 py-3">Returned Full</th>
                  <th className="px-4 py-3">Returned Empty</th>
                  <th className="px-4 py-3">Calculated Sold</th>
                  <th className="px-4 py-3">Actual Invoiced</th>
                  <th className="px-4 py-3">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-5 font-bold text-slate-600" colSpan={9}>
                      No routes found in this range.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-700">{formatDateDMY(row.date)}</td>
                      <td className="px-4 py-3 font-black text-slate-950">{row.salesman}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{row.branch}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{formatNumber(row.totalLoaded)}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{formatNumber(row.returnedFull)}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{formatNumber(row.returnedEmpty)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{formatNumber(row.calculatedSold)}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{formatNumber(row.actualInvoiced)}</td>
                      <td className={`px-4 py-3 font-black ${row.variance === 0 ? "text-slate-950" : "text-red-700"}`}>
                        {formatNumber(row.variance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
