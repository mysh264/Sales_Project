import Link from "next/link";
import { redirect } from "next/navigation";
import { saveProduct, toggleProductStatus } from "@/app/actions/products";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams?: Promise<{
    editId?: string;
  }>;
};

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN") {
    redirect("/admin");
  }

  const params = (await searchParams) ?? {};

  const [products, branches, productToEdit] = await Promise.all([
    prisma.product.findMany({
      include: {
        branch: true,
        priceRules: {
          where: { endsAt: null },
          orderBy: { startsAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      orderBy: { name: "asc" },
    }),
    params.editId
      ? prisma.product.findUnique({
          where: { id: params.editId },
        })
      : Promise.resolve(null),
  ]);

  const activeCount = products.filter((product) => product.isActive).length;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Admin / Products</p>
            <h1 className="text-3xl font-black text-slate-950">Product Master Data</h1>
            <p className="mt-2 text-sm font-bold text-slate-600">
              Add, edit, activate, and deactivate products by branch without breaking invoice history.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Back to Admin
            </Link>
            <Link href="/admin/products" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Refresh
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Total Products</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{products.length}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Active Products</p>
            <p className="mt-2 text-3xl font-black text-green-700">{activeCount}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Inactive Products</p>
            <p className="mt-2 text-3xl font-black text-red-700">{products.length - activeCount}</p>
          </article>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-black text-slate-950">{productToEdit ? "Edit Product" : "Add Product"}</h2>
            </div>
            <form action={saveProduct} className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              {productToEdit ? <input type="hidden" name="productId" value={productToEdit.id} /> : null}
              <label className="block">
                <span className="text-sm font-black text-slate-700">Branch</span>
                <select
                  name="branchId"
                  required
                  defaultValue={productToEdit?.branchId ?? branches[0]?.id ?? ""}
                  className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold"
                >
                  <option value="" disabled>
                    Select branch
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} · {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">SKU</span>
                <input
                  name="sku"
                  required
                  defaultValue={productToEdit?.sku ?? ""}
                  className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold uppercase"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Name</span>
                <input
                  name="name"
                  required
                  defaultValue={productToEdit?.name ?? ""}
                  className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Gas Type</span>
                <input
                  name="gasType"
                  required
                  defaultValue={productToEdit?.gasType ?? ""}
                  className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Cylinder Size</span>
                <input
                  name="cylinderSize"
                  required
                  defaultValue={productToEdit?.cylinderSize ?? ""}
                  className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Pressure</span>
                <input
                  name="pressure"
                  defaultValue={productToEdit?.pressure ?? ""}
                  className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-black text-slate-700">Unit Label</span>
                <input
                  name="unitLabel"
                  defaultValue={productToEdit?.unitLabel ?? "Cylinder"}
                  className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
              <div className="md:col-span-2">
                <button type="submit" className="h-11 rounded bg-slate-950 px-5 text-sm font-black text-white">
                  {productToEdit ? "Save Product" : "Create Product"}
                </button>
                {productToEdit ? (
                  <Link href="/admin/products" className="ml-3 inline-flex h-11 items-center rounded border border-slate-300 bg-white px-5 text-sm font-black text-slate-900">
                    New Blank Product
                  </Link>
                ) : null}
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-black text-slate-950">Product Directory</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Branch</th>
                    <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Size / Pressure</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Price Rule</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => {
                  const rule = product.priceRules[0];
                  return (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <p className="font-black text-slate-950">{product.name}</p>
                        <p className="text-xs font-bold text-slate-500">{product.id}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">{product.branch?.code ?? "No Branch"}</td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-500">{product.sku}</td>
                      <td className="px-4 py-2 font-bold text-slate-700">{product.gasType}</td>
                      <td className="px-4 py-2 font-bold text-slate-700">
                        {product.cylinderSize}
                        {product.pressure ? ` / ${product.pressure}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-black uppercase ${
                            product.isActive ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-bold text-slate-700">
                        {rule ? (
                          <div>
                            <p>{rule.currency}</p>
                            <p className="text-xs text-slate-500">
                              {rule.minPrice.toFixed(3)} - {rule.maxPrice.toFixed(3)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-500">No active rule</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/products?editId=${product.id}`}
                            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900"
                          >
                            Edit
                          </Link>
                          <form action={toggleProductStatus}>
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="currentStatus" value={String(product.isActive)} />
                            <button
                              type="submit"
                              className={`rounded px-3 py-2 text-xs font-black text-white ${
                                product.isActive ? "bg-red-700" : "bg-green-700"
                              }`}
                            >
                              {product.isActive ? "Delete" : "Restore"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={8}>
                      No products configured yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
