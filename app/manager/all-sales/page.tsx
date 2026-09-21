import { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OmanDateInput } from "@/components/OmanDateInput";
import { formatDateTimeDMY } from "@/lib/date-format";
import { invoiceAccessWhere } from "@/lib/invoice-access";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { StatusBadge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

type AllSalesSearchParams = {
  start?: string;
  end?: string;
  branchId?: string;
  userId?: string;
  page?: string;
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

function formatCurrency(value: Prisma.Decimal | number | null | undefined, currency: string) {
  const amount = value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export default async function ManagerAllSalesPage({
  searchParams,
}: {
  searchParams?: Promise<AllSalesSearchParams>;
}) {
  const currentUser = await getCurrentUser();
  await requirePermission(Permissions.Finance_Read);

  if (!currentUser) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const monthStart = parseDate(params.start) ?? startOfMonth();
  const monthEndExclusive = parseDate(params.end) ? nextDay(parseDate(params.end)!) : endOfMonth();
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const workspaceHome = currentUser.role === "ADMIN" ? "/admin" : "/manager";
  const pricingPath = currentUser.role === "ADMIN" ? "/admin/products" : "/manager/settings";
  const resetPath = currentUser.role === "ADMIN" ? "/admin/sales" : "/manager/all-sales";
  const branchId = currentUser.branchId;
  const requestedBranchId = hasGlobalAccess ? params.branchId?.trim() || null : branchId;
  const requestedUserId = params.userId?.trim() || null;
  const pageSize = 50;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const skip = (page - 1) * pageSize;

  const branchWhere = hasGlobalAccess
    ? requestedBranchId
      ? { branchId: requestedBranchId }
      : undefined
    : { branchId: branchId ?? "" };

  const invoiceWhere = {
    ...(branchWhere ?? {}),
    ...(requestedUserId ? { salesmanId: requestedUserId } : {}),
    ...invoiceAccessWhere(currentUser),
    status: "ISSUED" as const,
    createdAt: { gte: monthStart, lt: monthEndExclusive },
  };

  const [invoices, totalsByCurrency, totalCount] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        customer: true,
        salesman: true,
        branch: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.invoice.groupBy({
      by: ["currency"],
      where: invoiceWhere,
      _sum: { totalAmount: true, debtAmount: true },
    }),
    prisma.invoice.count({ where: invoiceWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const queryBase = new URLSearchParams();
  if (params.start) queryBase.set("start", params.start);
  if (params.end) queryBase.set("end", params.end);
  if (requestedBranchId) queryBase.set("branchId", requestedBranchId);
  if (requestedUserId) queryBase.set("userId", requestedUserId);
  const pageHref = (targetPage: number) => {
    const q = new URLSearchParams(queryBase);
    q.set("page", String(targetPage));
    return `${resetPath}?${q.toString()}`;
  };

  const fallbackCurrency = currentUser.branch?.defaultCurrency ?? "OMR";
  const formatTotals = (field: "totalAmount" | "debtAmount") =>
    totalsByCurrency.length > 0
      ? totalsByCurrency
          .map((total) => formatCurrency(total._sum[field], total.currency))
          .join(" · ")
      : formatCurrency(0, fallbackCurrency);

  const [branches, users] = await Promise.all([
    prisma.branch.findMany({
      where: hasGlobalAccess ? undefined : { id: currentUser.branchId ?? "" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.user.findMany({
      where: hasGlobalAccess
        ? { role: "SALESMAN" }
        : currentUser.branchId
          ? { branchId: currentUser.branchId, role: "SALESMAN" }
          : { id: "__no_user__" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, branchId: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow="Sales Ledger"
          title="All Sales"
          description={
            hasGlobalAccess
              ? "Global sales access is enabled for this account."
              : "Restricted to your branch because global sales access is disabled."
          }
          actions={
            <>
              <ButtonLink href={workspaceHome} variant="ghost">Back to Dashboard</ButtonLink>
              <ButtonLink href={pricingPath} variant="ghost">Price Settings</ButtonLink>
            </>
          }
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Stat label="Revenue in Period" value={formatTotals("totalAmount")} tone="success" />
          <Stat label="Outstanding Debt" value={formatTotals("debtAmount")} tone="danger" />
        </section>

        <Card className="overflow-hidden p-0">
          <CardHeader title="Filters" description="Filter the ledger by date range, branch or salesman." />
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
                {branches.map((branch) => (
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
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-4 flex gap-3">
              <button type="submit" className="ui-btn ui-btn-primary">Apply Filters</button>
              <Link href={resetPath} className="ui-btn ui-btn-ghost">Reset</Link>
            </div>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader
            title="Sales Ledger"
            description={`Showing ${invoices.length} of ${totalCount} invoices (page ${page} of ${totalPages}).`}
          />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Branch</th>
                  <th>Customer</th>
                  <th>Salesman</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Debt</th>
                  <th>Status</th>
                  <th className="text-right">Print</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="whitespace-nowrap">{formatDateTimeDMY(invoice.createdAt)}</td>
                    <td className="font-semibold text-slate-600">{invoice.branch.name}</td>
                    <td className="font-bold text-slate-900">{invoice.customer.name}</td>
                    <td className="font-semibold text-slate-700">{invoice.salesman.fullName}</td>
                    <td className="num">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
                    <td className="num text-rose-600">{formatCurrency(invoice.debtAmount, invoice.currency)}</td>
                    <td><StatusBadge status={invoice.status} /></td>
                    <td>
                      <div className="flex justify-end">
                        <Link href={`/print/${invoice.id}?size=a4`} className="ui-btn ui-btn-primary ui-btn-sm">
                          Print / View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={8}>
                      No sales found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <Link
                href={pageHref(Math.max(1, page - 1))}
                className={`ui-btn ui-btn-ghost ui-btn-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                aria-disabled={page <= 1}
              >
                Previous
              </Link>
              <p className="text-sm font-bold text-slate-600">
                Page {page} / {totalPages}
              </p>
              <Link
                href={pageHref(Math.min(totalPages, page + 1))}
                className={`ui-btn ui-btn-ghost ui-btn-sm ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
                aria-disabled={page >= totalPages}
              >
                Next
              </Link>
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
