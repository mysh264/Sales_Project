import { PaymentMethod, Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

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

export default async function SalesmanDashboardPage() {
  const today = startOfToday();

  const [salesman, unpaidInvoices, todaySales, cashCollectedToday, transfersCollectedToday, checksCollectedToday, todayPayments, latestInvoice] = await Promise.all([
    prisma.user.findFirst({
      where: { role: "SALESMAN", isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customerDebt.findMany({
      where: {
        balanceAmount: { gt: new Prisma.Decimal(0) },
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      include: {
        customer: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "ISSUED",
        createdAt: { gte: today },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        method: PaymentMethod.CASH,
        createdAt: { gte: today },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        method: PaymentMethod.BANK_TRANSFER,
        createdAt: { gte: today },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        method: PaymentMethod.CHECK,
        createdAt: { gte: today },
      },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: today } },
      include: {
        invoice: { include: { customer: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findFirst({
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const salesmanName = salesman?.fullName ?? "Salesman";
  const transactionCount = todayPayments.length;
  const stats = [
    { label: "Today Sales", value: formatOmr(todaySales._sum.totalAmount), tone: "bg-white text-ink" },
    { label: "Cash Collected", value: formatOmr(cashCollectedToday._sum.amount), tone: "bg-white text-success" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5">
      <section className="mx-auto flex max-w-md flex-col gap-4">
        <header className="rounded-lg bg-ink p-5 text-white shadow-lg">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Salesman</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">Welcome, {salesmanName}</h1>
          <p className="mt-2 text-base font-semibold text-slate-200">Debt collection and payment reconciliation.</p>
        </header>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase text-slate-500">Logged-in Salesman</p>
          <p className="mt-1 text-3xl font-black text-ink">{salesmanName}</p>
          <p className="mt-2 text-sm font-bold text-slate-600">{salesman?.phone ?? "No phone on file"}</p>
        </section>

        <Link
          href="/salesman/new-order"
          className="flex min-h-24 items-center justify-center rounded-lg bg-success px-5 text-center text-3xl font-black text-white shadow-lg active:scale-[0.99]"
        >
          New Sale
        </Link>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((stat) => (
            <article key={stat.label} className={`rounded-lg p-5 shadow-sm ${stat.tone}`}>
              <p className="text-base font-black uppercase text-slate-600">{stat.label}</p>
              <p className="mt-2 text-3xl font-black">{stat.value}</p>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/salesman/new-order"
            className="flex min-h-20 items-center justify-center rounded-lg bg-safety px-3 text-center text-xl font-black text-white shadow-sm"
          >
            Add Order
          </Link>
          <Link
            href="#reconciliation"
            className="flex min-h-20 items-center justify-center rounded-lg bg-white px-3 text-center text-xl font-black text-ink shadow-sm"
          >
            Reconciliation View
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

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase text-slate-500">Cash Collected Today</p>
              <p className="text-3xl font-black text-green-700">{formatOmr(cashCollectedToday._sum.amount)}</p>
            </div>
            <div>
              <p className="text-sm font-black uppercase text-slate-500">Transfers Collected Today</p>
              <p className="text-3xl font-black text-slate-950">{formatOmr(transfersCollectedToday._sum.amount)}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-black uppercase text-slate-500">Checks Collected Today</p>
            <p className="text-3xl font-black text-orange-700">{formatOmr(checksCollectedToday._sum.amount)}</p>
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase text-slate-500">Today Sales</p>
          <p className="mt-1 text-3xl font-black text-ink">{formatOmr(todaySales._sum.totalAmount)}</p>
          <p className="mt-2 text-sm font-bold text-slate-600">{transactionCount} transactions recorded today</p>
        </section>

        <section id="reconciliation" className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-lg font-black text-slate-950">Today Transactions</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
          <div className="mt-3 flex flex-col gap-3">
            {todayPayments.map((payment) => (
              <article key={payment.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{payment.invoice.customer.name}</p>
                    <p className="text-xs font-bold text-slate-500">{formatDate(payment.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black uppercase text-slate-500">{payment.method.replace("_", " ")}</p>
                    <p className="text-lg font-black text-slate-950">{formatOmr(payment.amount)}</p>
                  </div>
                </div>
              </article>
            ))}
            {todayPayments.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">No payments recorded today.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-lg font-black text-slate-950">Latest Print Shortcut</p>
          {latestInvoice ? (
            <Link
              href={`/salesman/receipt/${latestInvoice.id}`}
              className="mt-3 inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white"
            >
              Print Last
            </Link>
          ) : (
            <button className="mt-3 min-h-12 rounded-lg bg-slate-200 px-4 text-sm font-black text-slate-500" disabled>
              Print Last
            </button>
          )}
        </section>
      </section>
    </main>
  );
}
