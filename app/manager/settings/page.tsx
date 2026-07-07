import { updatePriceRule } from "@/app/actions/manager";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type ManagerSettingsSearchParams = {
  branchId?: string;
};

export default async function ManagerSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<ManagerSettingsSearchParams>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);

  const availableBranches = await prisma.branch.findMany({
    where: hasGlobalAccess ? undefined : { id: currentUser.branchId ?? "" },
    orderBy: { name: "asc" },
  });

  const selectedBranch =
    availableBranches.find((item) => item.id === params.branchId) ??
    currentUser.branch ??
    availableBranches[0] ??
    null;

  const products = selectedBranch
    ? await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [{ branchId: selectedBranch.id }, { branchId: null }],
        },
        include: {
          priceRules: {
            where: { branchId: selectedBranch.id, endsAt: null },
            orderBy: { startsAt: "desc" },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Manager Settings</p>
            <h1 className="text-3xl font-black text-slate-950">Price Management</h1>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Edit current price rules or create a new one for the selected branch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasGlobalAccess ? (
              <form method="get" className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Branch</label>
                <select
                  name="branchId"
                  defaultValue={selectedBranch?.id ?? ""}
                  className="h-11 rounded border border-slate-300 px-3 text-sm font-bold"
                >
                  {availableBranches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="h-11 rounded bg-slate-950 px-4 text-sm font-black text-white">
                  Switch
                </button>
              </form>
            ) : null}
            <Link href="/manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Back to Branch Dashboard
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Selected Branch</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{selectedBranch?.name ?? "No branch selected"}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Active Products</p>
            <p className="mt-2 text-2xl font-black text-green-700">{products.length}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Global Access</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{hasGlobalAccess ? "Enabled" : "Branch Only"}</p>
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Visibility</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Current Rule</th>
                  <th className="px-4 py-2">Edit Rule</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => {
                  const rule = product.priceRules[0];
                  const formId = `price-${product.id}`;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <p className="font-black text-slate-950">{product.name}</p>
                        <p className="text-xs font-bold text-slate-500">
                          {product.cylinderSize}
                          {product.pressure ? ` / ${product.pressure}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-black uppercase ${
                            product.branchId ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                          }`}
                        >
                          {product.branchId ? "Legacy branch-linked" : "Global"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-500">{product.sku}</td>
                      <td className="px-4 py-2 font-bold text-slate-700">
                        {rule ? (
                          <div>
                            <p>{rule.currency}</p>
                            <p className="text-xs text-slate-500">
                              {rule.minPrice.toFixed(3)} - {rule.maxPrice.toFixed(3)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-red-700">No active rule</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <form action={updatePriceRule} id={formId} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="branchId" value={selectedBranch?.id ?? ""} />
                          {rule ? <input type="hidden" name="ruleId" value={rule.id} /> : null}
                          <select
                            form={formId}
                            name="currency"
                            defaultValue={rule?.currency ?? selectedBranch?.defaultCurrency ?? "OMR"}
                            className="h-10 rounded border border-slate-300 px-3 text-sm font-bold"
                          >
                            <option value="OMR">OMR</option>
                            <option value="USD">USD</option>
                            <option value="AED">AED</option>
                          </select>
                          <input
                            form={formId}
                            name="minPrice"
                            type="number"
                            min="0"
                            step="0.001"
                            required
                            defaultValue={rule?.minPrice.toFixed(3) ?? ""}
                            placeholder="Min"
                            className="h-10 w-32 rounded border border-slate-300 px-3 text-right font-bold text-slate-950 outline-none focus:border-slate-950"
                          />
                          <input
                            form={formId}
                            name="maxPrice"
                            type="number"
                            min="0"
                            step="0.001"
                            required
                            defaultValue={rule?.maxPrice.toFixed(3) ?? ""}
                            placeholder="Max"
                            className="h-10 w-32 rounded border border-slate-300 px-3 text-right font-bold text-slate-950 outline-none focus:border-slate-950"
                          />
                        </form>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          form={formId}
                          type="submit"
                          className={`rounded px-4 py-2 text-sm font-black text-white ${rule ? "bg-slate-950" : "bg-green-700"}`}
                        >
                          {rule ? "Save Rule" : "Create Rule"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={8}>
                      No active products found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
