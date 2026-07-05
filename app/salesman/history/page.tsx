import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

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

export default async function SalesmanHistoryPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "SALESMAN") {
    redirect("/login");
  }

  const invoices = await prisma.invoice.findMany({
    where: { salesmanId: currentUser.id },
    include: {
      customer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-lg bg-ink p-5 text-white shadow-lg">
          <p className="text-sm font-black uppercase tracking-wide text-slate-300">My Sales History</p>
          <h1 className="mt-1 text-3xl font-black">Invoices by {currentUser.fullName}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-200">Only your own invoices are shown here.</p>
        </header>

        <Link href="/salesman" className="inline-flex w-fit rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
          Back to Dashboard
        </Link>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">{formatDate(invoice.createdAt)}</td>
                    <td className="px-4 py-2">
                      <p className="font-black text-slate-950">{invoice.customer.name}</p>
                      <p className="text-xs font-bold text-slate-500">{invoice.invoiceNumber}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-black text-slate-950">
                      {formatOmr(invoice.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{statusBadge(invoice.status)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Link
                        href={`/print/${invoice.id}?size=mobile`}
                        className="rounded bg-slate-950 px-3 py-2 text-xs font-black text-white"
                      >
                        View & Print
                      </Link>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center font-bold text-slate-500" colSpan={5}>
                      No invoices found.
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
