import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTimeDMY } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";

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

function statusBadge(status: string) {
  const classes =
    status === "ISSUED"
      ? "bg-green-100 text-green-800"
      : status === "CANCELLED"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-800";

  return <span className={`rounded px-2 py-1 text-xs font-black uppercase ${classes}`}>{status}</span>;
}

export default async function ManagerAllSalesPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const monthStart = startOfMonth();
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const branchId = currentUser.branchId;

  const invoices = await prisma.invoice.findMany({
    where: hasGlobalAccess
      ? { createdAt: { gte: monthStart } }
      : { branchId: branchId ?? "", createdAt: { gte: monthStart } },
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

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">Manager Sales View</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">All Sales</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">
            {hasGlobalAccess
              ? "Global sales access is enabled for this account."
              : "Restricted to your branch because global sales access is disabled."}
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Link href="/manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
            Back to Branch Dashboard
          </Link>
          <Link href="/manager/settings" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
            Price Settings
          </Link>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Revenue This Month</p>
            <p className="mt-2 text-3xl font-black text-green-700">{formatOmr(monthlyRevenue)}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Outstanding Debt</p>
            <p className="mt-2 text-3xl font-black text-red-700">{formatOmr(totalDebt)}</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Sales Ledger</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Branch</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Salesman</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Debt</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">
                      {formatDateTimeDMY(invoice.createdAt)}
                    </td>
                    <td className="px-4 py-2 font-bold text-slate-900">{invoice.branch.name}</td>
                    <td className="px-4 py-2 text-slate-900">{invoice.customer.name}</td>
                    <td className="px-4 py-2 text-slate-700">{invoice.salesman.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-black text-slate-950">
                      {formatOmr(invoice.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-black text-red-700">
                      {formatOmr(invoice.debtAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{statusBadge(invoice.status)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Link
                        href={`/print/${invoice.id}?size=a4`}
                        className="rounded bg-slate-950 px-3 py-2 text-xs font-black text-white"
                      >
                        Print/View
                      </Link>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center font-bold text-slate-500" colSpan={8}>
                      No sales found.
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
