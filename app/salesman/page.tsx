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

export default async function SalesmanDashboardPage() {
  const today = startOfToday();

  const [todaySales, todayCollected, outstandingDebt, openDebtCustomers, latestInvoice] = await Promise.all([
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
        method: { in: [PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER] },
        createdAt: { gte: today },
      },
    }),
    prisma.customerDebt.aggregate({
      _sum: { balanceAmount: true },
      where: {
        balanceAmount: { gt: new Prisma.Decimal(0) },
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
    }),
    prisma.customerDebt.groupBy({
      by: ["customerId"],
      where: {
        balanceAmount: { gt: new Prisma.Decimal(0) },
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
    }),
    prisma.invoice.findFirst({
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const stats = [
    { label: "Today Sales", value: formatOmr(todaySales._sum.totalAmount), tone: "bg-white text-ink" },
    { label: "Cash + Transfer", value: formatOmr(todayCollected._sum.amount), tone: "bg-white text-success" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5">
      <section className="mx-auto flex max-w-md flex-col gap-4">
        <header className="rounded-lg bg-ink p-5 text-white shadow-lg">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Salesman</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">Good Morning</h1>
          <p className="mt-2 text-base font-semibold text-slate-200">Debts stay visible until collected.</p>
        </header>

        <section className="rounded-lg border-4 border-red-600 bg-red-50 p-5 shadow-sm">
          <p className="text-lg font-black uppercase text-red-800">Outstanding Debts</p>
          <p className="mt-1 text-5xl font-black leading-none text-red-700">
            {formatOmr(outstandingDebt._sum.balanceAmount)}
          </p>
          <p className="mt-2 text-base font-bold text-red-900">{openDebtCustomers.length} customers need collection</p>
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
          {latestInvoice ? (
            <Link
              href={`/salesman/receipt/${latestInvoice.id}`}
              className="flex min-h-20 items-center justify-center rounded-lg bg-white px-3 text-center text-xl font-black text-ink shadow-sm"
            >
              Print Last
            </Link>
          ) : (
            <button className="min-h-20 rounded-lg bg-white px-3 text-xl font-black text-slate-400 shadow-sm" disabled>
              Print Last
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

