import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatOmr } from "@/lib/money";
import { getBranchScope, branchWhere } from "@/lib/branch-scope";
import { Prisma } from "@/generated/prisma/client";
import { formatDateTimeDMY } from "@/lib/date-format";

export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({ params }: { params: Promise<{ customerId: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { customerId } = await params;
  const scope = await getBranchScope();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...branchWhere(scope) },
    include: {
      branch: true,
      debts: {
        where: { balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        include: { invoice: { include: { payments: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) notFound();

  const totalBalance = customer.debts.reduce((sum, d) => sum.add(d.balanceAmount), new Prisma.Decimal(0));

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto max-w-screen-lg flex flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow="Finance / Statement"
          title={customer.name}
          description={`Customer ${customer.customerNumber} · ${customer.branch?.name ?? "—"}`}
          actions={
            <>
              <ButtonLink href={`/finance/statements/${customer.id}/export`} variant="primary">
                Export CSV
              </ButtonLink>
              <ButtonLink href="/finance/statements" variant="ghost">
                All Statements
              </ButtonLink>
            </>
          }
        />

        <Card>
          <CardHeader title="Outstanding Invoices" description={`Total balance owing: ${formatOmr(totalBalance)}`} />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Original</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.debts.map((debt) => {
                  const original = debt.originalAmount;
                  const paid = original.sub(debt.balanceAmount);
                  return (
                    <tr key={debt.id}>
                      <td className="is-strong">{debt.invoice.invoiceNumber}</td>
                      <td className="whitespace-nowrap">{formatDateTimeDMY(debt.invoice.createdAt)}</td>
                      <td className="num">{formatOmr(original)}</td>
                      <td className="num text-emerald-600">{formatOmr(paid)}</td>
                      <td className="num text-rose-600">{formatOmr(debt.balanceAmount)}</td>
                      <td>
                        <StatusBadge status={debt.status} />
                      </td>
                    </tr>
                  );
                })}
                {customer.debts.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={6}>
                      No outstanding balances.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex gap-3">
          <button
            type="button"
            className="ui-btn ui-btn-ghost"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>
    </main>
  );
}
