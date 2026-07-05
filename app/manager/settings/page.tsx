import { updatePriceRule } from "@/app/actions/manager";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManagerSettingsPage() {
  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });

  const products = branch
    ? await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [{ branchId: branch.id }, { branchId: null }],
        },
        include: {
          priceRules: {
            where: { branchId: branch.id, endsAt: null },
            orderBy: { startsAt: "desc" },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Manager Settings</p>
            <h1 className="text-3xl font-black text-slate-950">Price Management</h1>
            <p className="mt-1 text-sm font-bold text-slate-600">{branch?.name ?? "No branch configured"}</p>
          </div>
          <Link href="/manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
            Back to Branch Dashboard
          </Link>
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Cylinder</th>
                  <th className="px-4 py-2">Currency</th>
                  <th className="px-4 py-2">Min Price</th>
                  <th className="px-4 py-2">Max Price</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => {
                  const rule = product.priceRules[0];

                  return (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <p className="font-black text-slate-950">{product.name}</p>
                        <p className="text-xs font-bold text-slate-500">{product.sku}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">
                        {product.cylinderSize}
                        {product.pressure ? ` / ${product.pressure}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">{rule?.currency ?? "OMR"}</td>
                      <td className="px-4 py-2" colSpan={rule ? 1 : 3}>
                        {rule ? (
                          <form action={updatePriceRule} id={`price-${rule.id}`} className="contents">
                            <input type="hidden" name="ruleId" value={rule.id} />
                            <input
                              name="minPrice"
                              type="number"
                              min="0"
                              step="0.001"
                              defaultValue={rule.minPrice.toFixed(3)}
                              className="h-10 w-36 rounded border border-slate-300 px-3 text-right font-bold text-slate-950 outline-none focus:border-slate-950"
                            />
                          </form>
                        ) : (
                          <span className="font-bold text-red-700">No active price rule</span>
                        )}
                      </td>
                      {rule ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              form={`price-${rule.id}`}
                              name="maxPrice"
                              type="number"
                              min="0"
                              step="0.001"
                              defaultValue={rule.maxPrice.toFixed(3)}
                              className="h-10 w-36 rounded border border-slate-300 px-3 text-right font-bold text-slate-950 outline-none focus:border-slate-950"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              form={`price-${rule.id}`}
                              type="submit"
                              className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white"
                            >
                              Save
                            </button>
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
                {products.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={6}>
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
