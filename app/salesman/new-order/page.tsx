import { createOrder } from "@/app/actions/sales";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const paymentFields = [
  { label: "Cash", name: "cashAmount", placeholder: "0.000" },
  { label: "Check", name: "checkAmount", placeholder: "0.000" },
  { label: "Bank Transfer", name: "bankTransferAmount", placeholder: "0.000" },
];

export default async function NewOrderPage() {
  const salesman = await prisma.user.findFirst({
    where: { role: "SALESMAN", isActive: true },
    include: { branch: true },
    orderBy: { createdAt: "asc" },
  });

  const products = salesman?.branchId
    ? await prisma.product.findMany({
        where: { branchId: salesman.branchId, isActive: true },
        include: {
          priceRules: {
            where: { branchId: salesman.branchId, endsAt: null },
            orderBy: { startsAt: "desc" },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  if (!salesman?.branch) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
        <section className="max-w-md rounded-lg bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-black text-ink">No Salesman Found</h1>
          <p className="mt-2 text-lg font-bold text-slate-700">Run the database seed before creating orders.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5">
      <form action={createOrder} className="mx-auto flex max-w-md flex-col gap-4">
        <input type="hidden" name="branchId" value={salesman.branch.id} />
        <input type="hidden" name="salesmanId" value={salesman.id} />

        <header className="rounded-lg bg-ink p-5 text-white shadow-lg">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-300">{salesman.branch.name}</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">Customer & Cylinders</h1>
        </header>

        <Link
          href="/salesman"
          className="flex min-h-20 items-center justify-center rounded-lg bg-red-700 px-5 text-center text-2xl font-black text-white shadow-lg active:scale-[0.99]"
        >
          Cancel / Back to Dashboard
        </Link>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <label className="text-lg font-black text-ink" htmlFor="customerName">
            Customer Name
          </label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            placeholder="Customer name"
            className="mt-3 h-16 w-full rounded-lg border-4 border-slate-300 px-4 text-xl font-bold outline-none focus:border-ink"
          />

          <label className="mt-4 block text-lg font-black text-ink" htmlFor="customerPhone">
            Phone Number
          </label>
          <input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            inputMode="tel"
            placeholder={`${salesman.branch.defaultPhoneCode} phone`}
            className="mt-3 h-16 w-full rounded-lg border-4 border-slate-300 px-4 text-xl font-bold outline-none focus:border-ink"
          />
        </section>

        <section className="flex flex-col gap-3">
          {products.map((product) => {
            const priceRule = product.priceRules[0];
            const minPrice = priceRule?.minPrice.toFixed(3) ?? "0.000";
            const maxPrice = priceRule?.maxPrice.toFixed(3) ?? "0.000";

            return (
              <article key={product.id} className="rounded-lg bg-white p-4 shadow-sm">
                <input type="hidden" name="productId" value={product.id} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-ink">{product.name}</h2>
                    <p className="text-base font-bold text-slate-600">
                      {product.cylinderSize}
                      {product.pressure ? ` / ${product.pressure}` : ""}
                    </p>
                  </div>
                  <p className="rounded-md bg-slate-100 px-3 py-2 text-right text-sm font-black text-slate-700">
                    OMR {minPrice}-{maxPrice}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-base font-black text-slate-700">Full Out</span>
                    <input
                      name={`product-${product.id}-full`}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="mt-2 h-16 w-full rounded-lg border-4 border-slate-300 px-3 text-center text-3xl font-black outline-none focus:border-success"
                    />
                  </label>
                  <label className="block">
                    <span className="text-base font-black text-slate-700">Empty Back</span>
                    <input
                      name={`product-${product.id}-empty`}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="mt-2 h-16 w-full rounded-lg border-4 border-slate-300 px-3 text-center text-3xl font-black outline-none focus:border-safety"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-base font-black text-slate-700">Sale Price</span>
                  <input
                    name={`product-${product.id}-price`}
                    type="number"
                    min={minPrice}
                    max={maxPrice}
                    step="0.001"
                    inputMode="decimal"
                    placeholder={`OMR ${minPrice}`}
                    className="mt-2 h-16 w-full rounded-lg border-4 border-slate-300 px-4 text-2xl font-black outline-none focus:border-ink"
                  />
                </label>
              </article>
            );
          })}
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-2xl font-black text-ink">Payment</h2>
          <div className="mt-3 grid grid-cols-1 gap-3">
            {paymentFields.map((field) => (
              <label key={field.name} className="block">
                <span className="text-base font-black text-slate-700">{field.label}</span>
                <input
                  name={field.name}
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  placeholder={field.placeholder}
                  className="mt-2 h-16 w-full rounded-lg border-4 border-slate-300 px-4 text-2xl font-black outline-none focus:border-success"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <input
              name="checkReference"
              type="text"
              placeholder="Check number"
              className="h-14 w-full rounded-lg border-4 border-slate-300 px-4 text-lg font-bold outline-none focus:border-ink"
            />
            <input
              name="transferReference"
              type="text"
              placeholder="Bank transfer reference"
              className="h-14 w-full rounded-lg border-4 border-slate-300 px-4 text-lg font-bold outline-none focus:border-ink"
            />
          </div>

          <p className="mt-4 rounded-lg bg-red-50 p-3 text-base font-black text-red-800">
            Any unpaid balance is saved as customer debt.
          </p>
        </section>

        <section className="sticky bottom-0 -mx-4 bg-slate-100 px-4 pb-4 pt-2">
          <button
            type="submit"
            className="h-20 w-full rounded-lg bg-success px-4 text-2xl font-black text-white shadow-xl active:scale-[0.99]"
          >
            Save & Print Receipt
          </button>
        </section>
      </form>
    </main>
  );
}
