import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTimeDMY } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type CustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDebtPage({ params }: CustomerPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "SALESMAN" || !currentUser.branchId) {
    notFound();
  }

  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const customer = await prisma.customer.findFirst({
    where: {
      id,
      ...(hasGlobalAccess ? {} : { branchId: currentUser.branchId }),
      invoices: {
        some: { salesmanId: currentUser.id },
      },
    },
    include: {
      invoices: {
        where: {
          salesmanId: currentUser.id,
          ...(hasGlobalAccess ? {} : { branchId: currentUser.branchId }),
        },
        include: {
          payments: true,
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      debts: {
        where: {
          invoice: {
            salesmanId: currentUser.id,
            ...(hasGlobalAccess ? {} : { branchId: currentUser.branchId }),
          },
        },
        include: {
          invoice: true,
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const newOrderHref = `/salesman/new-order?customerId=${encodeURIComponent(customer.id)}`;

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-6">
      <section className="mx-auto flex max-w-3xl flex-col gap-4">
        <PageHeader
          title={customer.name}
          description={`${customer.phone ?? "No phone on file"} · Available credit ${formatMoney(customer.creditBalance, currentUser.branch?.defaultCurrency ?? "OMR")}`}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href={newOrderHref} className="ui-btn ui-btn-primary flex min-h-14 items-center justify-center text-center">
            New invoice for this customer
          </Link>
          <Link href="/salesman/history" className="ui-btn ui-btn-secondary flex min-h-14 items-center justify-center text-center">
            Sales history
          </Link>
          <Link href="/salesman" className="ui-btn ui-btn-secondary flex min-h-14 items-center justify-center text-center">
            Back to dashboard
          </Link>
        </div>

        <section className="ui-card p-5">
          <p className="text-sm font-black uppercase text-slate-500">Debt History</p>
          <div className="mt-3 flex flex-col gap-3">
            {customer.debts.map((debt) => (
              <article key={debt.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{debt.invoice.invoiceNumber}</p>
                    <p className="text-xs font-bold text-slate-500">{formatDateTimeDMY(debt.updatedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black uppercase text-slate-500">{debt.status.replaceAll("_", " ")}</p>
                    <p className="text-lg font-black text-red-700">{formatMoney(debt.balanceAmount, debt.invoice.currency)}</p>
                    <Link
                      href={`/print/${debt.invoiceId}?size=mobile`}
                      className="mt-2 inline-block text-xs font-black text-brand-700 underline"
                    >
                      Print/View
                    </Link>
                  </div>
                </div>
              </article>
            ))}
            {customer.debts.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">No debt records for this customer.</p>
            ) : null}
          </div>
        </section>

        <section className="ui-card p-5">
          <p className="text-sm font-black uppercase text-slate-500">Invoice History</p>
          <div className="mt-3 flex flex-col gap-3">
            {customer.invoices.map((invoice) => (
              <article key={invoice.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{invoice.invoiceNumber}</p>
                    <p className="text-xs font-bold text-slate-500">{formatDateTimeDMY(invoice.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black uppercase text-slate-500">Total</p>
                    <p className="text-lg font-black text-slate-950">{formatMoney(invoice.totalAmount, invoice.currency)}</p>
                    <p className="text-sm font-bold text-red-700">Debt {formatMoney(invoice.debtAmount, invoice.currency)}</p>
                    <Link
                      href={`/print/${invoice.id}?size=mobile`}
                      className="mt-2 inline-block text-xs font-black text-brand-700 underline"
                    >
                      Print/View
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
