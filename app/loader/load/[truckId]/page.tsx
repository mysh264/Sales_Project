import { notFound } from "next/navigation";
import Link from "next/link";
import { processMorningLoad } from "@/app/actions/loader";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MorningLoadPageProps = {
  params: Promise<{ truckId: string }>;
};

export default async function MorningLoadPage({ params }: MorningLoadPageProps) {
  const { truckId } = await params;

  const truck = await prisma.truck.findUnique({
    where: { id: truckId },
    include: { salesman: true },
  });

  if (!truck) {
    notFound();
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ branchId: truck.branchId }, { branchId: null }],
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <form action={processMorningLoad} className="mx-auto flex max-w-3xl flex-col gap-4">
        <input type="hidden" name="truckId" value={truck.id} />

        <header className="rounded-lg bg-ink p-5 text-white">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Morning Load</p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">{truck.plateNumber}</h1>
          <p className="mt-2 text-lg font-bold text-slate-200">{truck.salesman?.fullName ?? "No salesman assigned"}</p>
        </header>

        <Link
          href="/loader"
          className="flex min-h-20 items-center justify-center rounded-lg bg-red-700 px-5 text-center text-2xl font-black text-white shadow-lg active:scale-[0.99]"
        >
          Cancel / Back to Truck List
        </Link>

        <section className="flex flex-col gap-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-lg bg-white p-4 shadow-sm">
              <input type="hidden" name="productId" value={product.id} />
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-ink">{product.name}</h2>
                  <p className="text-base font-bold text-slate-600">
                    {product.cylinderSize}
                    {product.pressure ? ` / ${product.pressure}` : ""}
                  </p>
                </div>
                <label className="mt-3 block md:mt-0 md:w-56">
                  <span className="text-base font-black text-slate-700">Full Cylinders Loaded</span>
                  <input
                    name={`product-${product.id}-loaded`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="mt-2 h-16 w-full rounded-lg border-4 border-slate-300 px-3 text-center text-3xl font-black outline-none focus:border-success"
                  />
                </label>
              </div>
            </article>
          ))}
        </section>

        <button
          type="submit"
          className="sticky bottom-4 h-20 rounded-lg bg-success px-5 text-2xl font-black text-white shadow-xl active:scale-[0.99]"
        >
          Save Morning Load
        </button>
      </form>
    </main>
  );
}
