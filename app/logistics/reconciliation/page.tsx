import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { submitEveningReconcile } from "@/app/actions/logistics";
import { ReconciliationWorkbench } from "./ReconciliationWorkbench";
import { formatDateDMY } from "@/lib/date-format";
import { Permissions } from "@/lib/permissions";
import { checkPermission } from "@/lib/permission-guard";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReconciliationPageProps = {
  searchParams?: Promise<{
    salesmanId?: string;
  }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-OM", {
    maximumFractionDigits: 0,
  }).format(value);
}

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function LogisticsReconciliationPage({ searchParams }: ReconciliationPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!checkPermission(currentUser, Permissions.Logistics_Update)) {
    forbidden();
  }

  const params = (await searchParams) ?? {};
  const filter = hasGlobalSalesAccess(currentUser)
    ? {}
    : currentUser.branchId
      ? { branchId: currentUser.branchId }
      : {};

  const [salesmen, products] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "SALESMAN",
        isActive: true,
        ...filter,
      },
      include: {
        branch: true,
      },
      orderBy: [{ fullName: "asc" }],
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const selectedSalesmanId = params.salesmanId?.trim() || salesmen[0]?.id || "";
  const salesman =
    salesmen.find((item) => item.id === selectedSalesmanId) ??
    salesmen[0] ??
    null;

  if (!salesman) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-6xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">Logistics / Reconciliation</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Daily Reconciliation</h1>
          <p className="mt-3 text-base font-bold text-slate-700">No active salesmen are configured for this scope.</p>
          <div className="mt-5">
            <Link href="/loader" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Back to Loader
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const reconciliation = await prisma.dailyReconciliation.findUnique({
    where: {
      salesmanId_reconciliationDate: {
        salesmanId: salesman.id,
        reconciliationDate: todayDate(),
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
        orderBy: { productId: "asc" },
      },
      branch: true,
      salesman: true,
      loader: true,
    },
  });

  const morningItems = reconciliation?.items ?? [];

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">Logistics / Reconciliation</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Itemized Daily Load Reconciliation</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Morning snapshots and evening reconciliation for the selected salesman.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/loader" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
                Back to Loader
              </Link>
            </div>
          </div>
        </header>

        <ReconciliationWorkbench
          salesmen={salesmen.map((item) => ({
            id: item.id,
            fullName: item.fullName,
            branchName: item.branch?.name ?? null,
          }))}
          products={products.map((item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
          }))}
          selectedSalesmanId={salesman.id}
          selectedSalesmanName={salesman.fullName}
        />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Evening Load-In</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Reconcile the morning list</h2>
              <p className="mt-2 text-sm font-bold text-slate-600">
                {reconciliation
                  ? `Morning load recorded on ${formatDateDMY(reconciliation.morningLoggedAt)}.`
                  : "No morning snapshot has been recorded for this salesman yet."}
              </p>
            </div>
            {reconciliation ? (
              <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-black text-slate-900">
                Status: {reconciliation.status.replaceAll("_", " ")}
              </div>
            ) : null}
          </div>

          {reconciliation ? (
            <form action={submitEveningReconcile} className="mt-5 space-y-4">
              <input type="hidden" name="salesmanId" value={salesman.id} />
              <input type="hidden" name="reconciliationId" value={reconciliation.id} />
              {morningItems.map((item) => {
                const soldValue = item.soldFull || item.morningFull - item.eveningReturnedFull;

                return (
                  <fieldset key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <legend className="px-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      {item.product.name} · {item.product.sku}
                    </legend>
                    <input type="hidden" name="productId" value={item.productId} />
                    <input type="hidden" name="morningFull" value={item.morningFull} />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Morning Full</span>
                        <input
                          type="number"
                          value={item.morningFull}
                          readOnly
                          className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-center text-2xl font-black text-slate-900"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Returned Full</span>
                        <input
                          name="eveningReturnedFull"
                          type="number"
                          min="0"
                          defaultValue={item.eveningReturnedFull}
                          className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-center text-2xl font-black text-slate-900"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Returned Empty</span>
                        <input
                          name="eveningReturnedEmpty"
                          type="number"
                          min="0"
                          defaultValue={item.eveningReturnedEmpty}
                          className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-center text-2xl font-black text-slate-900"
                        />
                      </label>
                    </div>
                    <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">
                      Sold: {formatNumber(soldValue)} · Empty Return should equal Sold
                    </div>
                  </fieldset>
                );
              })}

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="rounded bg-emerald-700 px-5 py-3 text-sm font-black text-white">
                  Save Evening Reconciliation
                </button>
                <Link href={`/logistics/reconciliation?salesmanId=${encodeURIComponent(salesman.id)}`} className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900">
                  Reload Morning Snapshot
                </Link>
              </div>
            </form>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600">
              Select a salesman and save the morning load first. The evening form will appear here automatically.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
