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

function formatOmr(value: Prisma.Decimal | number | null | undefined) {
  const amount = value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: "OMR",
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

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: {
      customer: true,
      salesman: true,
      branch: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const monthlyRevenue = invoices.reduce((sum, invoice) => sum.add(invoice.totalAmount), new Prisma.Decimal(0));
  const totalDebt = invoices.reduce((sum, invoice) => sum.add(invoice.debtAmount), new Prisma.Decimal(0));

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
          <Stat label="Revenue This Month" value={formatOmr(monthlyRevenue)} tone="success" />
          <Stat label="Outstanding Debt" value={formatOmr(totalDebt)} tone="danger" />
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
          <CardHeader title="Sales Ledger" description={`${invoices.length} invoices in view.`} />
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
                    <td className="num">{formatOmr(invoice.totalAmount)}</td>
                    <td className="num text-rose-600">{formatOmr(invoice.debtAmount)}</td>
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
        </Card>
      </div>
    </main>
  );
}
