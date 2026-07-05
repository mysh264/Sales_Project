import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CustomerPageProps = {
  params: Promise<{ id: string }>;
};

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

export default async function CustomerDebtPage({ params }: CustomerPageProps) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      invoices: {
        include: {
          payments: true,
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      debts: {
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

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <section className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="rounded-lg bg-ink p-5 text-white shadow-lg">
          <p className="text-sm font-black uppercase tracking-wide text-slate-300">Customer Details</p>
          <h1 className="mt-1 text-3xl font-black">{customer.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-200">{customer.phone ?? "No phone on file"}</p>
        </header>

        <Link
          href="/salesman"
          className="flex min-h-16 items-center justify-center rounded-lg bg-slate-950 px-5 text-center text-xl font-black text-white shadow-lg"
        >
          Back to Dashboard
        </Link>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase text-slate-500">Debt History</p>
          <div className="mt-3 flex flex-col gap-3">
            {customer.debts.map((debt) => (
              <article key={debt.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{debt.invoice.invoiceNumber}</p>
                    <p className="text-xs font-bold text-slate-500">{formatDate(debt.updatedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black uppercase text-slate-500">{debt.status.replaceAll("_", " ")}</p>
                    <p className="text-lg font-black text-red-700">{formatOmr(debt.balanceAmount)}</p>
                  </div>
                </div>
              </article>
            ))}
            {customer.debts.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">No debt records for this customer.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase text-slate-500">Invoice History</p>
          <div className="mt-3 flex flex-col gap-3">
            {customer.invoices.map((invoice) => (
              <article key={invoice.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{invoice.invoiceNumber}</p>
                    <p className="text-xs font-bold text-slate-500">{formatDate(invoice.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black uppercase text-slate-500">Debt</p>
                    <p className="text-lg font-black text-red-700">{formatOmr(invoice.debtAmount)}</p>
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
