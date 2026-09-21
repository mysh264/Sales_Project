import { DebtStatus, Prisma } from "@/generated/prisma/client";
import { forbidden, redirect } from "next/navigation";
import { getFinancialSummary } from "@/app/actions/finance";
import { writeOffDebt } from "@/app/actions/manager";
import { formatDateTimeDMY } from "@/lib/date-format";
import { debtStatusWhere } from "@/lib/debt-filter";
import { Permissions } from "@/lib/permissions";
import { checkPermission, requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type ManagerDashboardPageProps = {
  searchParams?: Promise<{
    customer?: string;
    status?: string;
  }>;
};

function money(value: Prisma.Decimal | number | string | null | undefined) {
  const amount =
    value instanceof Prisma.Decimal ? value.toNumber() : typeof value === "string" ? Number(value) : Number(value ?? 0);
  return formatMoney(amount, "OMR");
}

type DebtRow = Prisma.CustomerDebtGetPayload<{
  include: {
    customer: true;
    invoice: {
      select: {
        id: true;
        invoiceNumber: true;
        debtCollectionAmount: true;
        totalAmount: true;
        taxAmount: true;
        createdAt: true;
      };
    };
  };
}>;

type DebtAuditScopeRow = {
  id: string;
  payments: {
    id: string;
  }[];
};

async function getFinanceUser() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    forbidden();
  }

  if (currentUser.role !== "ADMIN" && !checkPermission(currentUser, Permissions.Finance_Read)) {
    await requirePermission(Permissions.Finance_Read);
  }

  return currentUser;
}

export default async function ManagerDashboardPage({ searchParams }: ManagerDashboardPageProps) {
  const currentUser = await getFinanceUser();
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const workspaceHome =
    currentUser.role === "ADMIN" ? "/admin" : currentUser.role === "GENERAL_MANAGER" ? "/general-manager" : "/manager";
  const pricingPath =
    currentUser.role === "ADMIN"
      ? "/admin/products"
      : currentUser.role === "GENERAL_MANAGER"
        ? "/general-manager/products"
        : "/manager/settings";
  const resetPath =
    currentUser.role === "ADMIN"
      ? "/admin/finance"
      : currentUser.role === "GENERAL_MANAGER"
        ? "/general-manager/finance"
        : "/manager/dashboard";

  if (!currentUser.branchId && !hasGlobalAccess) {
    redirect("/manager");
  }

  const summary = await getFinancialSummary();
  const params = (await searchParams) ?? {};
  const customerFilter = params.customer?.trim() || "";
  const requestedStatus = params.status?.trim() || "";
  const statusFilter = Object.values(DebtStatus).includes(requestedStatus as DebtStatus)
    ? (requestedStatus as DebtStatus)
    : "";

  const scopeBranchId = !hasGlobalAccess ? currentUser.branchId ?? "" : "";

  const debtWhere: Prisma.CustomerDebtWhereInput = {
    ...(scopeBranchId
      ? {
          invoice: {
            branchId: scopeBranchId,
          },
        }
      : {}),
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
    ...debtStatusWhere(statusFilter),
  };

  const [debts, scopedInvoices, scopedDebts]: [DebtRow[], { id: string }[], DebtAuditScopeRow[]] = await Promise.all([
    prisma.customerDebt.findMany({
      where: debtWhere,
      include: {
        customer: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            debtCollectionAmount: true,
            totalAmount: true,
            taxAmount: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 25,
    }),
    prisma.invoice.findMany({
      where: scopeBranchId ? { branchId: scopeBranchId } : undefined,
      select: { id: true },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
    prisma.customerDebt.findMany({
      where: scopeBranchId
        ? {
            invoice: {
              branchId: scopeBranchId,
            },
          }
        : undefined,
      select: {
        id: true,
        payments: {
          select: { id: true },
          take: 50,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const scopedTargetIds = new Set([
    ...scopedInvoices.map((invoice) => invoice.id),
    ...scopedDebts.map((debt) => debt.id),
    ...scopedDebts.flatMap((debt) => debt.payments.map((payment) => payment.id)),
  ]);

  const recentFinancialAudits = await prisma.auditLog.findMany({
    where: {
      ...(scopeBranchId ? { targetId: { in: Array.from(scopedTargetIds) } } : {}),
      targetModel: {
        in: ["Invoice", "CustomerDebt", "DebtPayment", "Payment"],
      },
      action: {
        in: ["CREATE_INVOICE", "UPDATE_INVOICE", "COLLECT_DEBT", "UPDATE_PRICE_RULE"],
      },
    },
    include: {
      user: {
        select: {
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: [{ timestamp: "desc" }],
    take: 5,
  });

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          eyebrow="Finance Dashboard"
          title={`${summary.scopeLabel} Financial Overview`}
          description="Daily revenue, VAT, and debt tracking for the consolidated Manager account."
          actions={
            <>
              <ButtonLink href={workspaceHome} variant="ghost">
                Back to Dashboard
              </ButtonLink>
              <ButtonLink href={pricingPath} variant="primary">
                Price Settings
              </ButtonLink>
            </>
          }
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="ui-card ui-card-pad">
            <p className="ui-stat-label">Total Sales Today</p>
            <p className="mt-2 text-3xl font-black text-brand-700">{money(summary.totalSalesToday)}</p>
          </article>
          <article className="ui-card ui-card-pad">
            <p className="ui-stat-label">Total VAT Today</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{money(summary.totalVatToday)}</p>
          </article>
          <article className="ui-card ui-card-pad">
            <p className="ui-stat-label">Total Outstanding Debt</p>
            <p className="mt-2 text-3xl font-black text-rose-700">{money(summary.totalOutstandingDebt)}</p>
            <p className="mt-3 text-xs font-bold text-slate-500">
              Pending invoice debt collection recorded today: {money(summary.debtCollectedToday)}
            </p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="ui-card ui-card-pad h-fit xl:sticky xl:top-6">
            <h2 className="ui-section-title">Debt Filters</h2>
            <form method="get" className="mt-4 space-y-4">
              <div>
                <label className="ui-label">Customer Search</label>
                <input
                  name="customer"
                  defaultValue={customerFilter}
                  placeholder="Customer name"
                  className="ui-input"
                />
              </div>
              <div>
                <label className="ui-label">Status</label>
                <select
                  name="status"
                  defaultValue={statusFilter || "ALL"}
                  className="ui-input"
                >
                  <option value="ALL">Open / Partial</option>
                  <option value="OPEN">Open</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid</option>
                  <option value="WRITTEN_OFF">Written Off</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="ui-btn ui-btn-primary">
                  Apply Filters
                </button>
                <ButtonLink href={resetPath} variant="ghost">
                  Reset
                </ButtonLink>
              </div>
            </form>
          </aside>

          <div className="space-y-6">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-lg font-black text-slate-950">Outstanding Debts</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Invoice</th>
                      <th className="px-4 py-2 text-right">Original</th>
                      <th className="px-4 py-2 text-right">Debt Collection</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Updated</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {debts.map((debt) => (
                      <tr key={debt.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="font-black text-slate-950">{debt.customer.name}</div>
                          <div className="text-xs font-bold text-slate-500">{debt.customer.phone ?? "No phone"}</div>
                        </td>
                        <td className="px-4 py-2 font-bold text-slate-700">{debt.invoice.invoiceNumber}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-slate-900">
                          {money(debt.originalAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-slate-900">
                          {money(debt.invoice.debtCollectionAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-black text-rose-700">
                          {money(debt.balanceAmount)}
                        </td>
                        <td className="px-4 py-2"><StatusBadge status={debt.status} /></td>
                        <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">
                          {formatDateTimeDMY(debt.updatedAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {debt.balanceAmount.greaterThan(0) && debt.status !== "WRITTEN_OFF" ? (
                            <form action={writeOffDebt} className="flex justify-end gap-2">
                              <input type="hidden" name="debtId" value={debt.id} />
                              <input
                                name="reason"
                                required
                                minLength={5}
                                placeholder="Write-off reason"
                                className="h-9 w-40 rounded border border-slate-300 px-2 text-xs font-bold"
                              />
                              <button
                                type="submit"
                                className="h-9 rounded bg-slate-700 px-3 text-xs font-black text-white"
                              >
                                Write Off
                              </button>
                            </form>
                          ) : (
                            <span className="text-xs font-bold text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {debts.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center font-bold text-slate-500" colSpan={7}>
                          No outstanding debts found for the selected scope.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-lg font-black text-slate-950">Recent Financial Audit Snippet</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {recentFinancialAudits.map((log) => (
                  <details key={log.id} className="group px-4 py-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-black text-slate-950">{log.action.replaceAll("_", " ")}</p>
                          <p className="text-xs font-bold text-slate-500">
                            {log.user.fullName} · {log.user.role.replaceAll("_", " ")} · {log.targetModel} / {log.targetId}
                          </p>
                        </div>
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                          {formatDateTimeDMY(log.timestamp)}
                        </span>
                      </div>
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-800">
                        {JSON.stringify(log.oldValue ?? null, null, 2)}
                      </pre>
                      <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-800">
                        {JSON.stringify(log.newValue ?? null, null, 2)}
                      </pre>
                    </div>
                  </details>
                ))}
                {recentFinancialAudits.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm font-bold text-slate-500">
                    No financial audit entries found for this scope.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
