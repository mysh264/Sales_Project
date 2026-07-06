import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type PrintPageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ size?: string }>;
};

function money(value: Prisma.Decimal | number | null | undefined) {
  const amount = value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);
  return amount.toFixed(3);
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function UnifiedPrintPage({ params, searchParams }: PrintPageProps) {
  const { invoiceId } = await params;
  const { size } = await searchParams;
  const isA4 = size === "a4";

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      branch: true,
      salesman: true,
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
  const debtCollectionAmount = invoice.debtCollectionAmount;
  const serial = invoice.invoiceSerial ?? invoice.invoiceNumber;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-black print:bg-white print:p-0">
      <div className="print-hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-black uppercase text-slate-500">Print Format</p>
          <h1 className="text-xl font-black text-slate-950">{isA4 ? "A4 Invoice" : "Mobile Receipt"}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded bg-green-700 px-4 py-3 text-sm font-black text-white"
          >
            Done
          </Link>
          <Link
            href={`/print/${invoice.id}?size=mobile`}
            className="rounded border border-slate-300 px-4 py-3 text-sm font-black text-slate-950"
          >
            Mobile
          </Link>
          <Link
            href={`/print/${invoice.id}?size=a4`}
            className="rounded border border-slate-300 px-4 py-3 text-sm font-black text-slate-950"
          >
            A4
          </Link>
          <PrintButton />
        </div>
      </div>

      <section
        className={`mx-auto bg-white text-black ${
          isA4
            ? "print-a4 max-w-[210mm] p-12 font-sans text-base shadow-sm"
            : "print-mobile w-[80mm] max-w-[300px] p-3 font-mono text-xs leading-tight shadow-sm tabular-nums"
        }`}
      >
        {isA4 ? (
          <>
            <header className="flex items-start justify-between border-b-2 border-black pb-6">
              <div>
                <h2 className="text-3xl font-black uppercase leading-tight">NATIONAL INDUSTRIAL GAS PLANT - OMAN</h2>
                <p className="mt-2 font-bold">Suhar Industrial City Phase 7, P.O.Box 1195 Zip Code 311</p>
                <p className="font-bold">VAT/TRN: 0M1100407450</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black uppercase tracking-wide">Tax Invoice</p>
                <p className="mt-2 font-bold">{serial}</p>
                <p>{dateTime(invoice.createdAt)}</p>
              </div>
            </header>

            <section className="mt-6 grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm font-black uppercase text-slate-600">Bill To</p>
                <p className="mt-2 text-xl font-black">{invoice.customer.name}</p>
                <p>{invoice.customer.phone ?? "No phone"}</p>
                <p>{invoice.customer.address ?? ""}</p>
                <p>{invoice.customer.vatNumber ? `VAT: ${invoice.customer.vatNumber}` : ""}</p>
              </div>
              <div>
                <p className="text-sm font-black uppercase text-slate-600">Branch / Salesman</p>
                <p className="mt-2 font-bold">{invoice.branch.name}</p>
                <p>{invoice.salesman.fullName}</p>
                <p>{invoice.currency}</p>
              </div>
            </section>

            <h3 className="mt-8 text-base font-black uppercase text-slate-700">Invoice Items</h3>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-y-2 border-black">
                  <th className="py-2 text-left">Product</th>
                  <th className="py-2 text-right">Full Delivered</th>
                  <th className="py-2 text-right">Empty Returned</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="py-2">
                      <p className="font-bold">{item.product.name}</p>
                      <p className="text-xs">
                        {item.product.cylinderSize}
                        {item.product.pressure ? ` / ${item.product.pressure}` : ""}
                      </p>
                    </td>
                    <td className="py-2 text-right">{item.fullCylindersDelivered}</td>
                    <td className="py-2 text-right">{item.emptyCylindersReturned}</td>
                    <td className="py-2 text-right">{money(item.unitPrice)}</td>
                    <td className="py-2 text-right font-bold">{money(item.lineSubtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="ml-auto mt-8 w-80 space-y-2 text-sm tabular-nums">
              <div className="grid grid-cols-[150px_1fr] gap-4">
                <span className="font-bold">Subtotal</span>
                <span className="text-right">
                  {money(invoice.subtotalAmount)} {invoice.currency}
                </span>
              </div>
              <div className="grid grid-cols-[150px_1fr] gap-4">
                <span className="font-bold">VAT</span>
                <span className="text-right">
                  {money(invoice.taxAmount)} {invoice.currency}
                </span>
              </div>
              <div className="grid grid-cols-[150px_1fr] gap-4 border-t-2 border-black pt-2 text-xl font-black">
                <span>Total</span>
                <span className="text-right">
                  {money(invoice.totalAmount)} {invoice.currency}
                </span>
              </div>
            </section>

            <section className="ml-auto mt-6 w-80 space-y-2 rounded-lg border border-slate-300 p-4 text-sm tabular-nums">
              <h3 className="font-black uppercase text-slate-700">Payment Summary</h3>
              <div className="grid grid-cols-[150px_1fr] gap-4 font-bold">
                <span>Collected Now</span>
                <span className="text-right">
                  {money(debtCollectionAmount)} {invoice.currency}
                </span>
              </div>
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="grid grid-cols-[150px_1fr] gap-4">
                  <span>{payment.method.replace("_", " ")}</span>
                  <span className="text-right">
                    {money(payment.amount)} {invoice.currency}
                  </span>
                </div>
              ))}
            </section>

            <section className="ml-auto mt-4 w-80 rounded-lg border-2 border-slate-900 bg-slate-100 p-4 tabular-nums">
              <h3 className="text-sm font-black uppercase text-slate-700">Debt Overview</h3>
              <div className="mt-2 grid grid-cols-[190px_1fr] gap-4 text-base font-black text-red-700">
                <span>Remaining Outstanding Balance</span>
                <span className="text-right">
                  {money(debtBalance)} {invoice.currency}
                </span>
              </div>
            </section>

            <section className="mt-24 grid grid-cols-2 gap-20">
              <div className="border-t-2 border-black pt-3 text-center font-bold">Customer</div>
              <div className="border-t-2 border-black pt-3 text-center font-bold">Authorized</div>
            </section>
          </>
        ) : (
          <>
            <header className="text-center">
              <h2 className="text-base font-black uppercase leading-tight">NATIONAL INDUSTRIAL GAS PLANT - OMAN</h2>
              <p className="mt-1 text-sm font-black uppercase">Tax Invoice</p>
              <p>VAT: 0M1100407450</p>
              <p>{serial}</p>
              <p>{dateTime(invoice.createdAt)}</p>
            </header>

            <div className="my-2 border-t border-dashed border-black" />

            <section>
              <p>
                <span className="font-bold">Customer:</span> {invoice.customer.name}
              </p>
              <p>
                <span className="font-bold">Phone:</span> {invoice.customer.phone ?? "-"}
              </p>
            </section>

            <div className="my-2 border-t border-dashed border-black" />

            <section className="space-y-2">
              <p className="font-black uppercase">Invoice Items</p>
              {invoice.items.map((item) => (
                <div key={item.id}>
                  <p className="font-black">
                    {item.product.name} {item.product.cylinderSize}
                  </p>
                  <div className="flex justify-between">
                    <span>Full</span>
                    <span>{item.fullCylindersDelivered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Empty</span>
                    <span>{item.emptyCylindersReturned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price</span>
                    <span>{money(item.unitPrice)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{money(item.lineSubtotal)}</span>
                  </div>
                </div>
              ))}
            </section>

            <div className="my-2 border-t border-dashed border-black" />

            <section className="space-y-1">
              <p className="font-black uppercase">Payment Summary</p>
              <div className="flex justify-between">
                <span>Collected Now</span>
                <span>
                  {money(debtCollectionAmount)} {invoice.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(invoice.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT</span>
                <span>{money(invoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-black">
                <span>Total</span>
                <span>
                  {money(invoice.totalAmount)} {invoice.currency}
                </span>
              </div>
            </section>

            <section className="mt-2 border border-black bg-slate-100 p-2">
              <p className="font-black uppercase">Debt Overview</p>
              <div className="mt-1 flex justify-between gap-2 font-black text-red-700">
                <span>Remaining Balance</span>
                <span>{money(debtBalance)} {invoice.currency}</span>
              </div>
            </section>

            <section className="mt-8 grid grid-cols-2 gap-6 text-center">
              <div className="border-t border-black pt-1 font-bold">Customer</div>
              <div className="border-t border-black pt-1 font-bold">Authorized</div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
