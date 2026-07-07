import { DebtStatus, InvoiceStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFinancialSummary } from "@/app/actions/finance";
import { formatDateTimeDMY } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

type ManagerSearchParams = {
  start?: string;
  end?: string;
  branchId?: string;
  userId?: string;
  customer?: string;
  status?: string;
};

const activeDebtStatuses: DebtStatus[] = ["OPEN", "PARTIALLY_PAID"];

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

function formatOmr(value: Prisma.Decimal | number | null | undefined) {
  const amount = value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

function statusBadge(status: string) {
  const classes =
    status === "ISSUED"
      ? "bg-green-100 text-green-800"
      : status === "CANCELLED"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-800";

  return <span className={`rounded px-2 py-1 text-xs font-black uppercase ${classes}`}>{status}</span>;
}

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<ManagerSearchParams>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const startDate = parseDate(params.start) ?? startOfMonth();
  const endDateExclusive = parseDate(params.end) ? nextDay(parseDate(params.end)!) : endOfMonth();
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const branchId = !hasGlobalAccess ? currentUser.branchId ?? null : null;
  const requestedBranchId = hasGlobalAccess ? params.branchId?.trim() || null : branchId;
  const requestedUserId = params.userId?.trim() || null;
  const customerFilter = params.customer?.trim() || "";
  const statusFilter = params.status?.trim() || "";
  const branch =
    currentUser.branch ??
    (branchId
      ? await prisma.branch.findUnique({
          where: { id: branchId },
        })
      : null);

  if (!hasGlobalAccess && !branch) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-lg bg-white p-6 text-xl font-black text-slate-900 shadow-sm">
          No branch is configured for this account.
        </div>
      </main>
    );
  }

  const [availableBranches, availableUsers] = await Promise.all([
    prisma.branch.findMany({
      where: hasGlobalAccess ? undefined : { id: branch?.id ?? "" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.user.findMany({
      where: hasGlobalAccess
        ? undefined
        : branch?.id
          ? { branchId: branch.id }
          : { id: "__no_user__" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, branchId: true },
    }),
  ]);

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    ...(hasGlobalAccess
      ? requestedBranchId
        ? { branchId: requestedBranchId }
        : {}
      : { branchId: branchId ?? "" }),
    ...(requestedUserId ? { salesmanId: requestedUserId } : {}),
    ...(customerFilter
      ? {
          customer: {
            name: {
              contains: customerFilter,
              mode: "insensitive" as const,
            },
          },
        }
      : {}),
    ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter as InvoiceStatus } : { status: "ISSUED" }),
    createdAt: {
      gte: startDate,
      lt: endDateExclusive,
    },
  };

  const debtWhere: Prisma.CustomerDebtWhereInput = {
    ...(hasGlobalAccess
      ? requestedBranchId
        ? { customer: { branchId: requestedBranchId } }
        : {}
      : { customer: { branchId: branch?.id ?? "" } }),
    ...(requestedUserId ? { invoice: { salesmanId: requestedUserId } } : {}),
    ...(customerFilter
      ? {
          customer: {
            name: {
              contains: customerFilter,
              mode: "insensitive" as const,
            },
          },
        }
      : {}),
    balanceAmount: { gt: new Prisma.Decimal(0) },
    status: { in: activeDebtStatuses },
    createdAt: {
      gte: startDate,
      lt: endDateExclusive,
    },
  };

  const movementWhere = hasGlobalAccess
    ? requestedBranchId
      ? { branchId: requestedBranchId, createdAt: { gte: startDate, lt: endDateExclusive } }
      : { createdAt: { gte: startDate, lt: endDateExclusive } }
    : { branchId: branch?.id ?? "", createdAt: { gte: startDate, lt: endDateExclusive } };

  const [summary, outstandingDebt, movementCount, globalViewUsers, userCount] = await Promise.all([
    getFinancialSummary({
      startDate,
      endDateExclusive,
      branchId: requestedBranchId,
      salesmanId: requestedUserId,
    }),
    prisma.customerDebt.aggregate({
      _sum: { balanceAmount: true },
      where: debtWhere,
    }),
    prisma.cylinderMovement.count({ where: movementWhere }),
    prisma.user.count({
      where: {
        OR: [{ hasGlobalAccess: true }, { allowGlobalSalesView: true }],
      },
    }),
    prisma.user.count(),
  ]);

  const latestInvoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: {
      customer: true,
      salesman: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const outstandingDebtValue = outstandingDebt._sum?.balanceAmount ?? new Prisma.Decimal(0);

  const stats = [
    { label: "Revenue in Scope", value: formatOmr(Number(summary.totalSalesToday)), tone: "text-green-700" },
    { label: "Outstanding Debt", value: formatOmr(outstandingDebtValue), tone: "text-red-700" },
    { label: "Cylinder Movements", value: movementCount.toLocaleString("en-OM"), tone: "text-slate-900" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Branch Manager</p>
            <h1 className="text-3xl font-black text-slate-950">{branch?.name ?? "All Branches"}</h1>
            <p className="mt-1 text-sm font-bold text-slate-600">
            {hasGlobalAccess ? "Global sales visibility is enabled for this account." : "Branch-level view only."}
          </p>
        </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/manager/settings" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Price Settings
            </Link>
            <Link href="/manager/all-sales" className="rounded bg-green-700 px-4 py-2 text-sm font-black text-white">
              All Sales
            </Link>
            <Link href="/general-manager/users" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
              User Management
            </Link>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Scope Filters</h2>
          </div>
          <form method="get" className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Start Date</span>
              <input name="start" type="date" defaultValue={params.start ?? ""} className="mt-2 h-12 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">End Date</span>
              <input name="end" type="date" defaultValue={params.end ?? ""} className="mt-2 h-12 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Branch</span>
              <select name="branchId" defaultValue={requestedBranchId ?? ""} className="mt-2 h-12 w-full rounded border border-slate-300 px-3 text-sm font-bold">
                <option value="">{hasGlobalAccess ? "All Branches" : "Current Branch"}</option>
                {availableBranches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Salesman</span>
              <select name="userId" defaultValue={requestedUserId ?? ""} className="mt-2 h-12 w-full rounded border border-slate-300 px-3 text-sm font-bold">
                <option value="">All Salesmen</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2 xl:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Customer Search</span>
              <input name="customer" defaultValue={customerFilter} placeholder="Customer name" className="mt-2 h-12 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
              <select name="status" defaultValue={statusFilter || "ALL"} className="mt-2 h-12 w-full rounded border border-slate-300 px-3 text-sm font-bold">
                <option value="ALL">Open / Partial</option>
                <option value="OPEN">Open</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
                <option value="WRITTEN_OFF">Written Off</option>
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-4 flex gap-3">
              <button type="submit" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">Apply Filters</button>
              <Link href="/manager" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">Reset</Link>
            </div>
          </form>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className={`mt-2 text-3xl font-black ${stat.tone}`}>{stat.value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Latest Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Salesman</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Debt</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Print Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {latestInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-900">{invoice.invoiceNumber}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">{formatDateTimeDMY(invoice.createdAt)}</td>
                    <td className="px-4 py-2 text-slate-900">{invoice.customer.name}</td>
                    <td className="px-4 py-2 text-slate-700">{invoice.salesman.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-slate-900">
                      {formatOmr(invoice.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-red-700">
                      {formatOmr(invoice.debtAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{statusBadge(invoice.status)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/print/${invoice.id}?size=mobile`}
                          className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-950"
                        >
                          Mobile Receipt
                        </Link>
                        <Link
                          href={`/print/${invoice.id}?size=a4`}
                          className="rounded bg-slate-950 px-3 py-2 text-xs font-black text-white"
                        >
                          A4 Invoice
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {latestInvoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={8}>
                      No invoices yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">User Management</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            <article className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Users</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{userCount}</p>
            </article>
            <article className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Global Sales View</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{globalViewUsers}</p>
            </article>
            <div className="flex items-center">
              <Link href="/general-manager/users" className="rounded bg-slate-950 px-4 py-3 text-sm font-black text-white">
                Open Employee Directory
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
