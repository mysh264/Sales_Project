import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { processMorningLoad } from "@/app/actions/loader";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

type MorningLoadPageProps = {
  params: Promise<{ salesmanId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function MorningLoadPage({ params, searchParams }: MorningLoadPageProps) {
  const { salesmanId } = await params;
  const query = (await searchParams) ?? {};
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const branchScope = hasGlobalAccess ? {} : currentUser.branchId ? { branchId: currentUser.branchId } : { branchId: "__no_branch__" };

  const salesman = await prisma.user.findFirst({
    where: { id: salesmanId, ...branchScope },
    include: {
      branch: true,
      salesmanReconciliations: {
        where: {
          reconciliationDate: todayDate(),
        },
        include: {
          items: {
            include: { product: true },
            orderBy: { productId: "asc" },
          },
        },
        orderBy: { morningLoggedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!salesman || salesman.role !== "SALESMAN") {
    notFound();
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const existingRoute = salesman.salesmanReconciliations[0] ?? null;
  const errorMessage = query.error ?? "";

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <form action={processMorningLoad} className="mx-auto flex max-w-4xl flex-col gap-4">
        <input type="hidden" name="salesmanId" value={salesman.id} />

        <header className="rounded-lg bg-ink p-5 text-white">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Morning Load</p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">{salesman.fullName}</h1>
          <p className="mt-2 text-lg font-bold text-slate-200">{salesman.branch?.name ?? "No branch assigned"}</p>
          {existingRoute ? (
            <p className="mt-2 text-sm font-bold text-slate-300">
              Existing route today: {existingRoute.status.replaceAll("_", " ")}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 rounded-lg bg-amber-100 px-4 py-3 text-sm font-black text-amber-900">
              {errorMessage}
            </p>
          ) : null}
        </header>

        <Link
          href="/loader"
          className="flex min-h-20 items-center justify-center rounded-lg bg-red-700 px-5 text-center text-2xl font-black text-white shadow-lg active:scale-[0.99]"
        >
          Cancel / Back to Dashboard
        </Link>

        <section className="grid grid-cols-1 gap-4">
          {products.map((product) => (
            <article key={product.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <input type="hidden" name="productId" value={product.id} />
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-ink md:text-2xl">{product.name}</h2>
                  <p className="text-sm font-bold text-slate-600">
                    {product.cylinderSize}
                    {product.pressure ? ` / ${product.pressure}` : ""}
                  </p>
                </div>
                <label className="mt-3 block md:mt-0 md:w-56">
                  <span className="text-sm font-black text-slate-700">Full Cylinders Loaded</span>
                  <input
                    name={`product-${product.id}-loaded`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="mt-2 h-14 w-full rounded-lg border border-slate-300 px-3 text-center text-2xl font-black outline-none focus:border-slate-950"
                  />
                </label>
              </div>
            </article>
          ))}
        </section>

        <button
          type="submit"
          className="sticky bottom-4 h-16 rounded-lg bg-slate-950 px-5 text-xl font-black text-white shadow-lg active:scale-[0.99]"
        >
          Save Morning Load
        </button>
      </form>
    </main>
  );
}
