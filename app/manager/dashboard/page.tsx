import { DebtStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { getFinancialSummary } from "@/app/actions/finance";
import { formatDateTimeDMY } from "@/lib/date-format";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ManagerDashboardPageProps = {
  searchParams?: Promise<{
    customer?: string;
    status?: string;
  }>;
};

function formatOmr(value: Prisma.Decimal | number | string | null | undefined) {
  const amount =
    value instanceof Prisma.Decimal ? value.toNumber() : typeof value === "string" ? Number(value) : Number(value ?? 0);

  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

function statusBadge(status: string) {
  const classes =
    status === "PAID"
      ? "bg-green-100 text-green-800"
      : status === "PARTIALLY_PAID"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return <span className={`rounded px-2 py-1 text-xs font-black uppercase ${classes}`}>{status.replaceAll("_", " ")}</span>;
}

const openDebtStatuses: DebtStatus[] = [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID];

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
  try {
    return (await requirePermission(Permissions.Finance_Read)).user;
  } catch {
    forbidden();
  }
}

export default async function ManagerDashboardPage({ searchParams }: ManagerDashboardPageProps) {
  const currentUser = await getFinanceUser();
  const hasGlobalAccess = currentUser.role === "ADMIN" || Boolean(currentUser.allowGlobalSalesView);

  if (!currentUser.branchId && !hasGlobalAccess) {
    redirect("/manager");
  }

  const summary = await getFinancialSummary();
  const params = (await searchParams) ?? {};
  const customerFilter = params.customer?.trim() || "";
  const statusFilter = params.status?.trim() || "";

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
    ...(statusFilter && statusFilter !== "ALL"
      ? {
          status: statusFilter as DebtStatus,
        }
      : {
          status: {
            in: openDebtStatuses,
          },
        }),
    balanceAmount: {
      gt: new Prisma.Decimal(0),
    },
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
      ...(scopedTargetIds.size > 0
        ? {
            targetId: { in: Array.from(scopedTargetIds) },
          }
        : {}),
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
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">Finance Dashboard</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">
                {summary.scopeLabel} Financial Overview
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Daily revenue, VAT, and debt tracking for managers and accountants.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/manager" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
                Back to Branch Dashboard
              </Link>
              <Link href="/manager/settings" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Price Settings
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Total Sales Today</p>
            <p className="mt-2 text-3xl font-black text-green-700">{formatOmr(summary.totalSalesToday)}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Total VAT Today</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{formatOmr(summary.totalVatToday)}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Total Outstanding Debt</p>
            <p className="mt-2 text-3xl font-black text-red-700">{formatOmr(summary.totalOutstandingDebtToday)}</p>
            <p className="mt-3 text-xs font-bold text-slate-500">
              Pending invoice debt collection recorded today: {formatOmr(summary.pendingDebtCollectionToday)}
            </p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
            <h2 className="text-lg font-black text-slate-950">Debt Filters</h2>
            <form method="get" className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Customer Search</label>
                <input
                  name="customer"
                  defaultValue={customerFilter}
                  placeholder="Customer name"
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Status</label>
                <select
                  name="status"
                  defaultValue={statusFilter || "ALL"}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                >
                  <option value="ALL">Open / Partial</option>
                  <option value="OPEN">Open</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid</option>
                  <option value="WRITTEN_OFF">Written Off</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
                  Apply Filters
                </button>
                <Link href="/manager/dashboard" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
                  Reset
                </Link>
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
                          {formatOmr(debt.originalAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-slate-900">
                          {formatOmr(debt.invoice.debtCollectionAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-black text-red-700">
                          {formatOmr(debt.balanceAmount)}
                        </td>
                        <td className="px-4 py-2">{statusBadge(debt.status)}</td>
                        <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">
                          {formatDateTimeDMY(debt.updatedAt)}
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
