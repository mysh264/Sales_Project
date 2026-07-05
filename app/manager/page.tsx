import { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
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

function statusBadge(status: string) {
  const classes =
    status === "ISSUED"
      ? "bg-green-100 text-green-800"
      : status === "CANCELLED"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-800";

  return <span className={`rounded px-2 py-1 text-xs font-black uppercase ${classes}`}>{status}</span>;
}

export default async function ManagerDashboardPage() {
  const monthStart = startOfMonth();
  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });

  if (!branch) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-7xl rounded-lg bg-white p-6 text-xl font-black text-slate-900 shadow-sm">
          No branch is configured.
        </div>
      </main>
    );
  }

  const [monthlyRevenue, outstandingDebt, movementCount, latestInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        branchId: branch.id,
        status: "ISSUED",
        createdAt: { gte: monthStart },
      },
    }),
    prisma.customerDebt.aggregate({
      _sum: { balanceAmount: true },
      where: {
        customer: { branchId: branch.id },
        balanceAmount: { gt: new Prisma.Decimal(0) },
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
    }),
    prisma.cylinderMovement.count({
      where: {
        branchId: branch.id,
        createdAt: { gte: monthStart },
      },
    }),
    prisma.invoice.findMany({
      where: { branchId: branch.id },
      include: {
        customer: true,
        salesman: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const stats = [
    { label: "Revenue This Month", value: formatOmr(monthlyRevenue._sum.totalAmount), tone: "text-green-700" },
    { label: "Outstanding Debt", value: formatOmr(outstandingDebt._sum.balanceAmount), tone: "text-red-700" },
    { label: "Cylinder Movements", value: movementCount.toLocaleString("en-OM"), tone: "text-slate-900" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Branch Manager</p>
            <h1 className="text-3xl font-black text-slate-950">{branch.name}</h1>
          </div>
          <Link href="/manager/settings" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
            Price Settings
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className={`mt-2 text-3xl font-black ${stat.tone}`}>{stat.value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Latest Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Salesman</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Debt</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Print Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {latestInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-900">{invoice.invoiceNumber}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">{formatDate(invoice.createdAt)}</td>
                    <td className="px-4 py-2 text-slate-900">{invoice.customer.name}</td>
                    <td className="px-4 py-2 text-slate-700">{invoice.salesman.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-slate-900">
                      {formatOmr(invoice.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-red-700">
                      {formatOmr(invoice.debtAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{statusBadge(invoice.status)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/print/${invoice.id}?size=mobile`}
                          className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-950"
                        >
                          Mobile Receipt
                        </Link>
                        <Link
                          href={`/print/${invoice.id}?size=a4`}
                          className="rounded bg-slate-950 px-3 py-2 text-xs font-black text-white"
                        >
                          A4 Invoice
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {latestInvoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={8}>
                      No invoices yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
