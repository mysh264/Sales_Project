import { notFound, redirect } from "next/navigation";
import { processEveningReturn } from "@/app/actions/loader";
import { formatDateDMY } from "@/lib/date-format";
import { hasGlobalWriteScope } from "@/lib/global-access";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { businessDate } from "@/lib/business-date";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

function todayDate() {
  return businessDate();
}

export default async function EveningReturnPage({ params, searchParams }: { params: Promise<{ salesmanId: string }>; searchParams?: Promise<{ error?: string }> }) {
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

  const reconciliation = salesman.salesmanReconciliations[0] ?? null;
  if (!reconciliation) {
    return (
      <main className="min-h-screen bg-app-bg p-4 md:p-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 animate-fade-in">
          <header className="rounded-2xl bg-brand-gradient p-5 text-white shadow-pop">
            <p className="text-sm font-bold uppercase tracking-wide text-white/70">Evening Return</p>
            <h1 className="mt-1 text-3xl font-black md:text-4xl">{salesman.fullName}</h1>
            <p className="mt-2 text-lg font-bold text-white/90">{salesman.branch?.name ?? "No branch assigned"}</p>
          </header>
          <ButtonLink href="/loader" variant="danger" className="min-h-[3.5rem] justify-center text-lg">
            Cancel / Back to Dashboard
          </ButtonLink>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 text-lg font-bold text-slate-700 shadow-card">
            No morning load has been recorded for this salesman today.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <form action={processEveningReturn} className="mx-auto flex max-w-4xl flex-col gap-4 animate-fade-in">
        <input type="hidden" name="salesmanId" value={salesman.id} />
        <input type="hidden" name="reconciliationId" value={reconciliation.id} />

        <header className="rounded-2xl bg-brand-gradient p-5 text-white shadow-pop">
          <p className="text-sm font-bold uppercase tracking-wide text-white/70">Evening Return</p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">{salesman.fullName}</h1>
          <p className="mt-2 text-lg font-bold text-white/90">{salesman.branch?.name ?? "No branch assigned"}</p>
          <p className="mt-2 text-sm font-bold text-white/80">Morning load recorded on {formatDateDMY(reconciliation.morningLoggedAt)}.</p>
          {query.error ? <p className="mt-3 rounded-lg bg-amber-100 px-4 py-3 text-sm font-black text-amber-900">{query.error}</p> : null}
        </header>

        <ButtonLink href="/loader" variant="danger" className="min-h-[3.5rem] justify-center text-lg">
          Cancel / Back to Dashboard
        </ButtonLink>

        <section className="flex flex-col gap-3">
          {reconciliation.items.map((item) => {
            const soldValue = item.soldFull || item.morningFull - item.eveningReturnedFull;
            return (
              <article key={item.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
                <input type="hidden" name="productId" value={item.productId} />
                <input type="hidden" name="morningFull" value={item.morningFull} />
                <h2 className="text-2xl font-black text-ink">{item.product.name}</h2>
                <p className="text-base font-bold text-slate-600">
                  {item.product.cylinderSize}
                  {item.product.pressure ? ` / ${item.product.pressure}` : ""}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="ui-label">Morning Full</span>
                    <input
                      type="number"
                      value={item.morningFull}
                      readOnly
                      className="mt-2 h-16 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 text-center text-3xl font-black text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="ui-label">Returned Full</span>
                    <input
                      name="eveningReturnedFull"
                      type="number"
                      min="0"
                      defaultValue={item.eveningReturnedFull}
                      className="ui-input mt-2 h-16 text-center text-3xl"
                    />
                  </label>
                  <label className="block">
                    <span className="ui-label">Returned Empty</span>
                    <input
                      name="eveningReturnedEmpty"
                      type="number"
                      min="0"
                      defaultValue={item.eveningReturnedEmpty}
                      className="ui-input mt-2 h-16 text-center text-3xl"
                    />
                  </label>
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">
                    Sold for this product: {soldValue}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <button
          type="submit"
          className="sticky bottom-4 pb-safe h-20 rounded-2xl bg-brand-gradient px-5 text-2xl font-black text-white shadow-pop active:scale-[0.99]"
        >
          Save Evening Return
        </button>
      </form>
    </main>
  );
}
