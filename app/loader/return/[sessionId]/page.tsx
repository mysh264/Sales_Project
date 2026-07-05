import { notFound } from "next/navigation";
import Link from "next/link";
import { processEveningReturn } from "@/app/actions/loader";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EveningReturnPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function EveningReturnPage({ params }: EveningReturnPageProps) {
  const { sessionId } = await params;

  const session = await prisma.truckLoadSession.findFirst({
    where: { id: sessionId, returnedAt: null },
    include: {
      truck: true,
      salesman: true,
    },
  });

  if (!session) {
    notFound();
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ branchId: session.truck.branchId }, { branchId: null }],
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <form action={processEveningReturn} className="mx-auto flex max-w-4xl flex-col gap-4">
        <input type="hidden" name="sessionId" value={session.id} />

        <header className="rounded-lg bg-ink p-5 text-white">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Evening Return</p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">{session.truck.plateNumber}</h1>
          <p className="mt-2 text-lg font-bold text-slate-200">{session.salesman.fullName}</p>
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
              <h2 className="text-2xl font-black text-ink">{product.name}</h2>
              <p className="text-base font-bold text-slate-600">
                {product.cylinderSize}
                {product.pressure ? ` / ${product.pressure}` : ""}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-base font-black text-slate-700">Remaining Full</span>
                  <input
                    name={`product-${product.id}-remaining-full`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="mt-2 h-16 w-full rounded-lg border-4 border-slate-300 px-3 text-center text-3xl font-black outline-none focus:border-success"
                  />
                </label>
                <label className="block">
                  <span className="text-base font-black text-slate-700">Collected Empty</span>
                  <input
                    name={`product-${product.id}-collected-empty`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="mt-2 h-16 w-full rounded-lg border-4 border-slate-300 px-3 text-center text-3xl font-black outline-none focus:border-safety"
                  />
                </label>
              </div>
            </article>
          ))}
        </section>

        <button
          type="submit"
          className="sticky bottom-4 h-20 rounded-lg bg-safety px-5 text-2xl font-black text-white shadow-xl active:scale-[0.99]"
        >
          Save Evening Return
        </button>
      </form>
    </main>
  );
}
