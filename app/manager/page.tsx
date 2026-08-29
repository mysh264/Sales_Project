import { DebtStatus, InvoiceStatus, Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFinancialSummary } from "@//app/actions/finance";
import { OmanDateInput } from "@/components/OmanDateInput";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTimeDMY } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { hasPermission, Permissions } from "@/lib/permissions";

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
  const requestedStatus = params.status?.trim() || "";
  const statusFilter = requestedStatus === InvoiceStatus.CANCELLED ? InvoiceStatus.CANCELLED : InvoiceStatus.ISSUED;
  const branch =
    currentUser.branch ??
    (branchId
      ? await prisma.branch.findUnique({
          where: { id: branchId },
        })
      : null);

  if (!hasGlobalAccess && !branch) {
    return (
      <main className="min-h-screen bg-app-bg p-4 md:p-8">
        <Card className="mx-auto mt-10 max-w-xl text-center">
          <p className="text-xl font-black text-slate-900">No branch is configured for this account.</p>
        </Card>
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
        ? { role: "SALESMAN" }
        : branch?.id
          ? { branchId: branch.id, role: "SALESMAN" }
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
    status: statusFilter,
    createdAt: {
      gte: startDate,
      lt: endDateExclusive,
    },
  };

  const debtWhere: Prisma.CustomerDebtWhereInput = {
    customer: {
      ...(hasGlobalAccess
        ? requestedBranchId
          ? { branchId: requestedBranchId }
          : {}
        : { branchId: branch?.id ?? "" }),
      ...(customerFilter
        ? {
            name: {
              contains: customerFilter,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    ...(requestedUserId ? { invoice: { salesmanId: requestedUserId } } : {}),
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
        ...(!hasGlobalAccess ? { branchId: branchId ?? "__no_branch__" } : {}),
        OR: [{ hasGlobalAccess: true }, { allowGlobalSalesView: true }],
      },
    }),
    prisma.user.count({
      where: !hasGlobalAccess ? { branchId: branchId ?? "__no_branch__" } : undefined,
    }),
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
    { label: "Revenue in Scope", value: formatOmr(Number(summary.totalSalesToday)), tone: "success" as const },
    { label: "Outstanding Debt", value: formatOmr(outstandingDebtValue), tone: "danger" as const },
    { label: "Cylinder Movements", value: movementCount.toLocaleString("en-OM"), tone: "default" as const },
  ];

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto max-w-7xl animate-fade-in">
        <PageHeader
          eyebrow="Branch Manager"
          title={branch?.name ?? "All Branches"}
          description={hasGlobalAccess ? "Global sales visibility is enabled for this account." : "Branch-level view only."}
          actions={
            <>
              <ButtonLink href="/manager/settings" variant="primary">
                Price Settings
              </ButtonLink>
              <ButtonLink href="/manager/all-sales" variant="success">
                All Sales
              </ButtonLink>
              {hasPermission(currentUser, Permissions.Users_Update) ? (
                <ButtonLink href="/manager/users" variant="ghost">
                  User Management
                </ButtonLink>
              ) : null}
            </>
          }
        />

        <Card className="mb-6">
          <CardHeader title="Scope Filters" description="Narrow the dashboard to a date range, branch, salesman or customer." />
          <form method="get" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                {availableBranches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
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
            <label className="block md:col-span-2 xl:col-span-2">
              <span className="ui-label">Customer Search</span>
              <input name="customer" defaultValue={customerFilter} placeholder="Customer name" className="ui-input" />
            </label>
            <label className="block">
              <span className="ui-label">Status</span>
              <select name="status" defaultValue={statusFilter} className="ui-input">
                <option value="ISSUED">Issued</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-4 flex gap-3">
              <button type="submit" className="ui-btn ui-btn-primary">
                Apply Filters
              </button>
              <Link href="/manager" className="ui-btn ui-btn-ghost">
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
          ))}
        </section>

        <Card className="mt-6">
          <CardHeader title="Latest Invoices" />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Salesman</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Debt</th>
                  <th>Status</th>
                  <th className="text-right">Print Options</th>
                </tr>
              </thead>
              <tbody>
                {latestInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="is-strong">{invoice.invoiceNumber}</td>
                    <td className="whitespace-nowrap">{formatDateTimeDMY(invoice.createdAt)}</td>
                    <td>{invoice.customer.name}</td>
                    <td>{invoice.salesman.fullName}</td>
                    <td className="num">{formatOmr(invoice.totalAmount)}</td>
                    <td className="num text-rose-600">{formatOmr(invoice.debtAmount)}</td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/print/${invoice.id}?size=mobile`}
                          className="ui-btn ui-btn-ghost ui-btn-sm"
                        >
                          Mobile Receipt
                        </Link>
                        <Link
                          href={`/print/${invoice.id}?size=a4`}
                          className="ui-btn ui-btn-primary ui-btn-sm"
                        >
                          A4 Invoice
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {latestInvoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={8}>
                      No invoices yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="mt-6">
          <CardHeader title="User Management" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="ui-stat">
              <p className="ui-stat-label">Users</p>
              <p className="ui-stat-value">{userCount}</p>
            </div>
            <div className="ui-stat">
              <p className="ui-stat-label">Global Sales View</p>
              <p className="ui-stat-value">{globalViewUsers}</p>
            </div>
            <div className="flex items-center">
              <ButtonLink href="/manager/users" variant="primary">
                Open Employee Directory
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
