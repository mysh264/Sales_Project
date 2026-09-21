import { notFound, redirect } from "next/navigation";
import { processMorningLoad } from "@/app/actions/loader";
import { hasGlobalWriteScope } from "@/lib/global-access";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { businessDate } from "@/lib/business-date";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

function todayDate() {
  return businessDate();
}

export default async function MorningLoadPage({ params, searchParams }: { params: Promise<{ salesmanId: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { salesmanId } = await params;
  const query = (await searchParams) ?? {};
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const hasGlobalAccess = hasGlobalWriteScope(currentUser);
  const branchScope = hasGlobalAccess ? {} : currentUser.branchId ? { branchId: currentUser.branchId } : { branchId: "__no_branch__" };

  const salesman = await prisma.user.findFirst({
    where: { id: salesmanId, ...branchScope },
    include: {
      branch: true,
      salesmanReconciliations: {
        where: { reconciliationDate: todayDate() },
        include: { items: { include: { product: true }, orderBy: { productId: "asc" } } },
        orderBy: { morningLoggedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!salesman || salesman.role !== "SALESMAN") {
    notFound();
  }

  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const existingRoute = salesman.salesmanReconciliations[0] ?? null;
  const errorMessage = query.error ?? "";

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <form action={processMorningLoad} className="mx-auto flex max-w-4xl flex-col gap-4 animate-fade-in">
        <input type="hidden" name="salesmanId" value={salesman.id} />

        <header className="rounded-2xl bg-brand-gradient p-5 text-white shadow-pop">
          <p className="text-sm font-bold uppercase tracking-wide text-white/70">Morning Load</p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">{salesman.fullName}</h1>
          <p className="mt-2 text-lg font-bold text-white/90">{salesman.branch?.name ?? "No branch assigned"}</p>
          {existingRoute ? (
            <p className="mt-2 text-sm font-bold text-white/80">Existing route today: {existingRoute.status.replaceAll("_", " ")}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 rounded-lg bg-amber-100 px-4 py-3 text-sm font-black text-amber-900">{errorMessage}</p>
          ) : null}
        </header>

        <ButtonLink href="/loader" variant="danger" className="min-h-[3.5rem] justify-center text-lg">
          Cancel / Back to Dashboard
        </ButtonLink>

        <section className="grid grid-cols-1 gap-4">
          {products.map((product) => (
            <article key={product.id} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
              <input type="hidden" name="productId" value={product.id} />
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-ink md:text-2xl">{product.name}</h2>
                  <p className="text-sm font-bold text-slate-600">
                    {product.cylinderSize}
                    {product.pressure ? ` / ${product.pressure}` : ""}
                  </p>
                </div>
                <label className="block md:w-56">
                  <span className="ui-label">Full Cylinders Loaded</span>
                  <input
                    name="morningFull"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="ui-input mt-2 h-14 text-center text-2xl"
                  />
                </label>
              </div>
            </article>
          ))}
        </section>

        <button
          type="submit"
          className="sticky bottom-4 pb-safe h-16 rounded-2xl bg-brand-gradient px-5 text-xl font-black text-white shadow-pop active:scale-[0.99]"
        >
          Save Morning Load
        </button>
      </form>
    </main>
  );
}
