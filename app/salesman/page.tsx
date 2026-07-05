import { PaymentMethod, Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function paymentLabel(method: PaymentMethod) {
  return method.replaceAll("_", " ");
}

export default async function SalesmanDashboardPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "SALESMAN" || !currentUser.branchId) {
    redirect("/login");
  }

  const today = startOfToday();

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
  }).catch(() => []);

  const todaySales = await prisma.invoice
    .aggregate({
      _sum: { totalAmount: true },
      where: {
        salesmanId: currentUser.id,
        status: "ISSUED",
        createdAt: { gte: today },
      },
    })
    .catch(() => ({ _sum: { totalAmount: new Prisma.Decimal(0) } }));

  const cashCollectedToday = await prisma.payment
    .aggregate({
      _sum: { amount: true },
      where: {
        method: PaymentMethod.CASH,
        createdAt: { gte: today },
        invoice: { salesmanId: currentUser.id },
      },
    })
    .catch(() => ({ _sum: { amount: new Prisma.Decimal(0) } }));

  const transfersCollectedToday = await prisma.payment
    .aggregate({
      _sum: { amount: true },
      where: {
        method: PaymentMethod.BANK_TRANSFER,
        createdAt: { gte: today },
        invoice: { salesmanId: currentUser.id },
      },
    })
    .catch(() => ({ _sum: { amount: new Prisma.Decimal(0) } }));

  const checksCollectedToday = await prisma.payment
    .aggregate({
      _sum: { amount: true },
      where: {
        method: PaymentMethod.CHECK,
        createdAt: { gte: today },
        invoice: { salesmanId: currentUser.id },
      },
    })
    .catch(() => ({ _sum: { amount: new Prisma.Decimal(0) } }));

  const todayPayments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: today },
      invoice: { salesmanId: currentUser.id },
    },
    include: {
      invoice: { include: { customer: true } },
    },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  const latestInvoice = await prisma.invoice
    .findFirst({
      where: { salesmanId: currentUser.id },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => null);

  const stats = [
    { label: "Salesman", value: currentUser.fullName, tone: "bg-ink text-white" },
    { label: "Today Sales", value: formatOmr(todaySales._sum.totalAmount), tone: "bg-white text-ink" },
    { label: "Cash Collected", value: formatOmr(cashCollectedToday._sum.amount), tone: "bg-white text-success" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5">
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <header className="rounded-lg bg-ink p-5 text-white shadow-lg">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Salesman Dashboard</p>
            <h1 className="mt-1 text-3xl font-black leading-tight">Welcome, {currentUser.fullName}</h1>
            <p className="mt-2 text-base font-semibold text-slate-200">Debt collection, order entry, and daily reconciliation.</p>
          </header>

          <section className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Quick Stats</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {stats.map((stat) => (
                <article key={stat.label} className={`rounded-lg p-5 shadow-sm ${stat.tone}`}>
                  <p
                    className={`text-sm font-black uppercase tracking-wide ${
                      stat.tone.includes("bg-ink") ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {stat.label}
                  </p>
                  <p className="mt-2 break-words text-2xl font-black leading-tight">{stat.value}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <Link
              href="/salesman/new-order"
              className="flex min-h-20 w-full max-w-none items-center justify-center rounded-lg bg-success px-5 text-center text-2xl font-black text-white shadow-lg active:scale-[0.99] lg:max-w-md"
            >
              Create New Invoice
            </Link>
            <Link
              href="/salesman/history"
              className="flex min-h-20 w-full max-w-none items-center justify-center rounded-lg bg-slate-950 px-5 text-center text-2xl font-black text-white shadow-lg active:scale-[0.99] lg:max-w-md"
            >
              My Sales History
            </Link>
          </div>

          <section className="rounded-lg border-4 border-red-600 bg-red-50 p-5 shadow-sm">
            <p className="text-lg font-black uppercase text-red-800">Recent Unpaid Invoices</p>
            <div className="mt-3 flex flex-col gap-3">
              {unpaidInvoices.map((debt) => (
                <article key={debt.id} className="rounded-lg bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-ink">{debt.customer.name}</p>
                      <p className="text-sm font-bold text-slate-600">{debt.customer.phone ?? "No phone"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{debt.invoice.invoiceNumber}</p>
                    </div>
                    <p className="text-xl font-black text-red-700">{formatOmr(debt.balanceAmount)}</p>
                  </div>
                  <Link
                    href={`/salesman/customer/${debt.customerId}`}
                    className="mt-3 inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white"
                  >
                    View Customer Details
                  </Link>
                </article>
              ))}
              {unpaidInvoices.length === 0 ? (
                <p className="text-base font-bold text-red-900">No unpaid invoices are currently pending.</p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-1">
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-lg font-black text-slate-950">Payment Breakdown</p>
            <div className="mt-3 flex flex-col gap-3">
              <article className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Cash Collected Today</p>
                <p className="mt-1 text-2xl font-black text-green-700">{formatOmr(cashCollectedToday._sum.amount)}</p>
              </article>
              <article className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Transfers Collected Today</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{formatOmr(transfersCollectedToday._sum.amount)}</p>
              </article>
              <article className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Checks Collected Today</p>
                <p className="mt-1 text-2xl font-black text-orange-700">{formatOmr(checksCollectedToday._sum.amount)}</p>
              </article>
            </div>
          </section>

          <section id="reconciliation" className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-950">Reconciliation View</p>
                <p className="text-sm font-bold text-slate-600">{todayPayments.length} transactions recorded today</p>
              </div>
              <a href="#reconciliation" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Refresh View
              </a>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-1">
              <article className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Cash</p>
                <p className="mt-1 text-2xl font-black text-green-700">{formatOmr(cashCollectedToday._sum.amount)}</p>
              </article>
              <article className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Transfers</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{formatOmr(transfersCollectedToday._sum.amount)}</p>
              </article>
              <article className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Checks</p>
                <p className="mt-1 text-2xl font-black text-orange-700">{formatOmr(checksCollectedToday._sum.amount)}</p>
              </article>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {todayPayments.map((payment) => (
                <article key={payment.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{payment.invoice.customer.name}</p>
                      <p className="text-xs font-bold text-slate-500">{formatDate(payment.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black uppercase text-slate-500">{paymentLabel(payment.method)}</p>
                      <p className="text-lg font-black text-slate-950">{formatOmr(payment.amount)}</p>
                    </div>
                  </div>
                </article>
              ))}
              {todayPayments.length === 0 ? <p className="text-sm font-bold text-slate-500">No payments recorded today.</p> : null}
            </div>
          </section>

          <section className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-lg font-black text-slate-950">Latest Print Shortcut</p>
            {latestInvoice ? (
              <Link
                href={`/print/${latestInvoice.id}?size=mobile`}
                className="mt-3 inline-flex min-h-12 w-full max-w-none items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white lg:max-w-md"
              >
                View & Print
              </Link>
            ) : (
              <button className="mt-3 min-h-12 w-full max-w-none rounded-lg bg-slate-200 px-4 text-sm font-black text-slate-500 lg:max-w-md" disabled>
                View & Print
              </button>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
