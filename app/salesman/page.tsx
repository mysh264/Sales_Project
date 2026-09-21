import { PaymentMethod, Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTimeDMY } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { businessDayRange } from "@/lib/business-date";
import { refreshSalesmanDashboard } from "@/app/salesman/actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ButtonLink } from "@/components/ui/Button";
import { readLocale, t } from "@/components/LocaleToggle";

export const dynamic = "force-dynamic";

function paymentLabel(method: PaymentMethod) {
  return method.replaceAll("_", " ");
}

export default async function SalesmanDashboardPage() {
  const currentUser = await getCurrentUser();
  const locale = await readLocale();

  if (!currentUser || currentUser.role !== "SALESMAN" || !currentUser.branchId) {
    redirect("/login");
  }

  const currency = currentUser.branch?.defaultCurrency ?? "OMR";
  const today = businessDayRange().start;
  const money = (value: Prisma.Decimal | number | null | undefined) => formatMoney(value, currency);

  const unpaidInvoices = await prisma.customerDebt.findMany({
    where: {
      balanceAmount: { gt: new Prisma.Decimal(0) },
      status: { in: ["OPEN", "PARTIALLY_PAID"] },
      invoice: { salesmanId: currentUser.id },
    },
    include: {
      customer: true,
      invoice: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const [todaySales, cashCollectedToday, transfersCollectedToday, checksCollectedToday, todayPayments, latestInvoice] =
    await Promise.all([
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { salesmanId: currentUser.id, status: "ISSUED", createdAt: { gte: today } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { method: PaymentMethod.CASH, createdAt: { gte: today }, invoice: { salesmanId: currentUser.id } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          method: PaymentMethod.BANK_TRANSFER,
          createdAt: { gte: today },
          invoice: { salesmanId: currentUser.id },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { method: PaymentMethod.CHECK, createdAt: { gte: today }, invoice: { salesmanId: currentUser.id } },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: today }, invoice: { salesmanId: currentUser.id } },
        include: { invoice: { include: { customer: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.invoice.findFirst({
        where: { salesmanId: currentUser.id },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return (
    <main className="min-h-screen bg-app-bg px-4 py-5 pb-safe">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow={`${currentUser.branch?.name ?? "Branch"} · ${currency}`}
          title={`${t(locale, "welcomePrefix")} ${currentUser.fullName}`}
          description={t(locale, "salesmanHomeDesc")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label={t(locale, "todaySales")} value={money(todaySales._sum.totalAmount)} tone="brand" />
          <Stat label={t(locale, "cashCollected")} value={money(cashCollectedToday._sum.amount)} tone="success" />
          <Stat label={t(locale, "transfers")} value={money(transfersCollectedToday._sum.amount)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ButtonLink href="/salesman/new-order" size="lg" className="min-h-16 text-lg">
            {t(locale, "createInvoice")}
          </ButtonLink>
          <ButtonLink href="/salesman/history" variant="secondary" size="lg" className="min-h-16 text-lg">
            {t(locale, "myHistory")}
          </ButtonLink>
        </div>

        <section className="ui-card border-safety-500/40 p-5">
          <p className="text-sm font-black uppercase tracking-wide text-safety-700">{t(locale, "recentUnpaid")}</p>
          <div className="mt-3 flex flex-col gap-3">
            {unpaidInvoices.map((debt) => (
              <article key={debt.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">{debt.customer.name}</p>
                    <p className="text-sm font-bold text-slate-600">{debt.customer.phone ?? t(locale, "noPhone")}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{debt.invoice.invoiceNumber}</p>
                  </div>
                  <p className="text-xl font-black text-rose-700 dir-ltr" dir="ltr">
                    {formatMoney(debt.balanceAmount, debt.invoice.currency)}
                  </p>
                </div>
                <Link
                  href={`/salesman/customer/${debt.customerId}`}
                  className="ui-btn ui-btn-secondary mt-3 min-h-12 w-full sm:w-auto"
                >
                  {t(locale, "collectDebt")}
                </Link>
              </article>
            ))}
            {unpaidInvoices.length === 0 ? (
              <p className="text-sm font-bold text-slate-600">{t(locale, "noUnpaid")}</p>
            ) : null}
          </div>
        </section>

        <section id="reconciliation" className="ui-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-section-title">{t(locale, "todayPayments")}</p>
              <p className="text-sm font-bold text-slate-600">
                {todayPayments.length} · {t(locale, "checks")}{" "}
                <span dir="ltr">{money(checksCollectedToday._sum.amount)}</span>
              </p>
            </div>
            <form action={refreshSalesmanDashboard}>
              <button type="submit" className="ui-btn ui-btn-ghost ui-btn-sm">
                {t(locale, "refresh")}
              </button>
            </form>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {todayPayments.map((payment) => (
              <article key={payment.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{payment.invoice.customer.name}</p>
                    <p className="text-xs font-bold text-slate-500">{formatDateTimeDMY(payment.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black uppercase text-slate-500">{paymentLabel(payment.method)}</p>
                    <p className="text-lg font-black text-slate-950">
                      {formatMoney(payment.amount, payment.invoice.currency)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {todayPayments.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">No payments recorded today.</p>
            ) : null}
          </div>
        </section>

        <section className="ui-card p-5">
          <p className="ui-section-title">{t(locale, "printReceipt")}</p>
          {latestInvoice ? (
            <ButtonLink href={`/print/${latestInvoice.id}?size=mobile`} className="mt-3 min-h-12 w-full sm:w-auto">
              {t(locale, "print")}
            </ButtonLink>
          ) : (
            <button type="button" className="ui-btn ui-btn-subtle mt-3 min-h-12 w-full sm:w-auto" disabled>
              {t(locale, "print")}
            </button>
          )}
        </section>
      </section>
    </main>
  );
}
