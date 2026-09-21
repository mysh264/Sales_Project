import { redirect } from "next/navigation";
import { approveReconciliationDiscrepancy } from "@/app/actions/manager";
import { OmanDateInput } from "@/components/OmanDateInput";
import { businessDate } from "@/lib/business-date";
import { formatDateDMY } from "@/lib/date-format";
import { Permissions } from "@/lib/permissions";
import { checkPermission, requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type OverviewSearchParams = {
  start?: string;
  end?: string;
  branchId?: string;
  userId?: string;
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
  // Attribute invoices to the Muscat business day, not server-local time, so a sale at
  // 00:00–04:00 Muscat (20:00–24:00 UTC) is not mis-bucketed to the previous day.
  const d = businessDate(value);
  const year = d.getUTCFullYear();
  const month = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
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
  const workspaceHome =
    currentUser.role === "ADMIN" ? "/admin" : currentUser.role === "MANAGER" ? "/manager" : "/general-manager";
  const resetPath =
    currentUser.role === "ADMIN"
      ? "/admin/reconciliation"
      : currentUser.role === "MANAGER"
        ? "/manager/reconciliation"
        : "/general-manager/reconciliation";
  const startDate = parseDate(params.start) ?? startOfMonth();
  const endDateInput = parseDate(params.end);
  const endDateExclusive = endDateInput ? nextDay(endDateInput) : endOfMonth();
  const endDateDisplay = endDateInput ?? new Date(endDateExclusive.getFullYear(), endDateExclusive.getMonth(), endDateExclusive.getDate() - 1);
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const requestedBranchId = hasGlobalAccess ? params.branchId?.trim() || null : currentUser.branchId ?? null;
  const requestedUserId = params.userId?.trim() || null;
  const branchScope = hasGlobalAccess
    ? requestedBranchId
      ? { branchId: requestedBranchId }
      : {}
    : currentUser.branchId
      ? { branchId: currentUser.branchId }
      : { branchId: "__no_branch__" };

  const [availableBranches, availableUsers] = await Promise.all([
    prisma.branch.findMany({
      where: hasGlobalAccess ? undefined : { id: currentUser.branchId ?? "" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.user.findMany({
      where: hasGlobalAccess
        ? { role: "SALESMAN", isActive: true }
        : currentUser.branchId
          ? { branchId: currentUser.branchId, role: "SALESMAN", isActive: true }
          : { id: "__no_user__" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  const [reconciliations, invoices] = await Promise.all([
    prisma.dailyReconciliation.findMany({
      where: {
        reconciliationDate: {
          gte: startDate,
          lt: endDateExclusive,
        },
        ...branchScope,
        ...(requestedUserId ? { salesmanId: requestedUserId } : {}),
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
        status: "ISSUED",
        createdAt: {
          gte: startDate,
          lt: endDateExclusive,
        },
        ...branchScope,
        ...(requestedUserId ? { salesmanId: requestedUserId } : {}),
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
    const physicalShortage = reconciliation.items.reduce((total, item) => total + item.missingEmpty, 0);
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
      physicalShortage,
      calculatedSold,
      actualInvoiced,
      variance,
      status: reconciliation.status,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.loaded += row.totalLoaded;
      acc.returnedFull += row.returnedFull;
      acc.returnedEmpty += row.returnedEmpty;
      acc.physicalShortage += row.physicalShortage;
      acc.calculatedSold += row.calculatedSold;
      acc.actualInvoiced += row.actualInvoiced;
      acc.variance += row.variance;
      return acc;
    },
    { loaded: 0, returnedFull: 0, returnedEmpty: 0, physicalShortage: 0, calculatedSold: 0, actualInvoiced: 0, variance: 0 },
  );

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <PageHeader
          eyebrow="Finance / Reconciliation Overview"
          title="Loader to Invoice Hand-off"
          description="Compare what the loader recorded against what the salesman invoiced. Use this to spot missing sales or route variance."
          actions={
            <ButtonLink href={workspaceHome} variant="ghost">
              Back to Dashboard
            </ButtonLink>
          }
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="ui-card ui-card-pad">
            <p className="ui-stat-label">Total Loaded</p>
            <div className="mt-2 text-4xl font-black text-slate-950">{formatNumber(totals.loaded)}</div>
          </div>
          <div className="ui-card ui-card-pad">
            <p className="ui-stat-label">Returned Full</p>
            <div className="mt-2 text-4xl font-black text-amber-700">{formatNumber(totals.returnedFull)}</div>
          </div>
          <div className="ui-card ui-card-pad">
            <p className="ui-stat-label">Actual Invoiced</p>
            <div className="mt-2 text-4xl font-black text-brand-700">{formatNumber(totals.actualInvoiced)}</div>
          </div>
          <div className="ui-card ui-card-pad">
            <p className="ui-stat-label">Variance</p>
            <div className={`mt-2 text-4xl font-black ${totals.variance === 0 ? "text-slate-950" : "text-rose-700"}`}>
              {formatNumber(totals.variance)}
            </div>
          </div>
        </section>

        <section className="ui-card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="ui-section-title">Scope Filters</h2>
          </div>
          <form method="get" className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="ui-label">Start Date</span>
              <OmanDateInput name="start" defaultValue={params.start ?? ""} className="ui-input" />
            </label>
            <label className="block">
              <span className="ui-label">End Date</span>
              <OmanDateInput name="end" defaultValue={params.end ?? ""} className="ui-input" />
            </label>
            <label className="block">
              <span className="ui-label">Branch</span>
              <select name="branchId" defaultValue={requestedBranchId ?? ""} className="ui-input">
                <option value="">{hasGlobalAccess ? "All Branches" : "Current Branch"}</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="ui-label">Salesman</span>
              <select name="userId" defaultValue={requestedUserId ?? ""} className="ui-input">
                <option value="">All Salesmen</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-4 flex gap-3">
              <button type="submit" className="ui-btn ui-btn-primary">Apply Filters</button>
              <ButtonLink href={resetPath} variant="ghost">Reset</ButtonLink>
            </div>
          </form>
        </section>

        <section className="ui-card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="ui-section-title">Daily Comparison</h2>
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
                  <th className="px-4 py-3">Physical Shortage</th>
                  <th className="px-4 py-3">Calculated Sold</th>
                  <th className="px-4 py-3">Actual Invoiced</th>
                  <th className="px-4 py-3">Variance</th>
                  <th className="px-4 py-3">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-5 font-bold text-slate-600" colSpan={11}>
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
                      <td className="px-4 py-3 font-black text-amber-700">{formatNumber(row.physicalShortage)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{formatNumber(row.calculatedSold)}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{formatNumber(row.actualInvoiced)}</td>
                      <td className={`px-4 py-3 font-black ${row.variance === 0 ? "text-slate-950" : "text-red-700"}`}>
                        {formatNumber(row.variance)}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === "DISCREPANCY_PENDING" ? (
                          <form action={approveReconciliationDiscrepancy} className="flex min-w-72 gap-2">
                            <input type="hidden" name="reconciliationId" value={row.id} />
                            <input name="reason" required minLength={5} placeholder="Approval reason" className="h-10 flex-1 rounded border px-2" />
                            <button className="rounded bg-amber-700 px-3 font-black text-white">Approve</button>
                          </form>
                        ) : (
                          <span className="font-bold text-emerald-700">Closed</span>
                        )}
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
