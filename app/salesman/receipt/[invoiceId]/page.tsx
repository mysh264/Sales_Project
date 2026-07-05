import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReceiptPageProps = {
  params: Promise<{ invoiceId: string }>;
};

function money(value: Prisma.Decimal | number | null | undefined) {
  const amount = value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);
  return amount.toFixed(3);
}

function receiptDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      items: {
        include: { product: true },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        orderBy: { createdAt: "asc" },
      },
      customerDebts: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  const debtBalance = invoice.customerDebts.reduce(
    (sum, debt) => sum.add(debt.balanceAmount),
    new Prisma.Decimal(0),
  );
  const serial = invoice.invoiceSerial ?? invoice.invoiceNumber;

  return (
    <main className="min-h-screen bg-white text-black print:min-h-0">
      <div className="mx-auto w-full max-w-md bg-white p-4 print:hidden">
        <Link
          href="/salesman"
          className="flex min-h-20 items-center justify-center rounded-lg bg-green-700 px-5 text-center text-2xl font-black text-white shadow-lg"
        >
          Done / Back to Dashboard
        </Link>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Link
            href={`/print/${invoice.id}?size=mobile`}
            className="flex min-h-16 items-center justify-center rounded-lg bg-slate-950 px-5 text-center text-xl font-black text-white shadow-lg"
          >
            Print Small Receipt
          </Link>
          <Link
            href={`/print/${invoice.id}?size=a4`}
            className="flex min-h-16 items-center justify-center rounded-lg bg-blue-700 px-5 text-center text-xl font-black text-white shadow-lg"
          >
            Print Full Invoice
          </Link>
        </div>
      </div>
      <section className="mx-auto w-[80mm] max-w-[300px] bg-white px-2 py-3 font-mono text-[11px] leading-tight text-black">
        <header className="text-center">
          <h1 className="text-sm font-black uppercase">NATIONAL INDUSTRIAL GAS PLANT - OMAN</h1>
          <p className="mt-1">VAT: 0M1100407450</p>
          <p>Suhar Industrial City Phase 7</p>
        </header>

        <div className="my-2 border-t border-dashed border-black" />

        <section className="space-y-1">
          <div className="flex justify-between gap-2">
            <span>Invoice</span>
            <span className="text-right">{serial}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>ID</span>
            <span className="text-right">{invoice.id}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Date</span>
            <span className="text-right">{receiptDate(invoice.createdAt)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Customer</span>
            <span className="text-right">{invoice.customer.name}</span>
          </div>
          {invoice.customer.address ? (
            <div className="flex justify-between gap-2">
              <span>Address</span>
              <span className="text-right">{invoice.customer.address}</span>
            </div>
          ) : null}
          {invoice.customer.vatNumber ? (
            <div className="flex justify-between gap-2">
              <span>VAT</span>
              <span className="text-right">{invoice.customer.vatNumber}</span>
            </div>
          ) : null}
          {invoice.customer.phone ? (
            <div className="flex justify-between gap-2">
              <span>Phone</span>
              <span className="text-right">{invoice.customer.phone}</span>
            </div>
          ) : null}
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        <section>
          <div className="grid grid-cols-[1fr_28px_28px_48px_52px] gap-1 border-b border-black pb-1 font-bold">
            <span>Item</span>
            <span className="text-right">Full</span>
            <span className="text-right">Emp</span>
            <span className="text-right">Price</span>
            <span className="text-right">Total</span>
          </div>
          {invoice.items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_28px_28px_48px_52px] gap-1 border-b border-dashed border-black py-1">
              <span>
                {item.product.name} {item.product.cylinderSize}
              </span>
              <span className="text-right">{item.fullCylindersDelivered}</span>
              <span className="text-right">{item.emptyCylindersReturned}</span>
              <span className="text-right">{money(item.unitPrice)}</span>
              <span className="text-right">{money(item.lineSubtotal)}</span>
            </div>
          ))}
        </section>

        <section className="mt-2 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(invoice.subtotalAmount)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT</span>
            <span>{money(invoice.taxAmount)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between border-t border-black pt-1 text-sm font-black">
            <span>Total</span>
            <span>{money(invoice.totalAmount)} {invoice.currency}</span>
          </div>
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        <section className="space-y-1">
          <p className="font-bold">Payments</p>
          {invoice.payments.length > 0 ? (
            invoice.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between gap-2">
                <span>{payment.method.replace("_", " ")}</span>
                <span>{money(payment.amount)} {invoice.currency}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between">
              <span>Paid</span>
              <span>0.000 {invoice.currency}</span>
            </div>
          )}
          <div className="flex justify-between font-black">
            <span>Outstanding Debt</span>
            <span>{money(debtBalance)} {invoice.currency}</span>
          </div>
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        <footer className="text-center">
          <p>Thank you</p>
          <p>Keep this receipt for your records</p>
        </footer>
      </section>
    </main>
  );
}
