import { adjustInventory } from "@/app/actions/inventory";
import { branchWhere, getBranchScope } from "@/lib/branch-scope";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requirePermission(Permissions.Inventory_Update);
  const scope = await getBranchScope();
  const [branches, products, balances] = await Promise.all([
    prisma.branch.findMany({
      where: scope?.canSeeAllBranches ? undefined : { id: scope?.branchId ?? "__no_branch__" },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.inventoryBalance.findMany({
      where: branchWhere(scope),
      include: { branch: true, product: true },
      orderBy: [{ branch: { name: "asc" } }, { product: { name: "asc" } }],
    }),
  ]);

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Controlled Stock Ledger"
          title="Inventory Adjustments"
        />
        <form action={adjustInventory} className="grid gap-4 rounded-lg bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="grid gap-1"><span className="text-sm font-black text-slate-700">Branch</span><select name="branchId" required className="h-12 rounded border px-3">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="grid gap-1"><span className="text-sm font-black text-slate-700">Product</span><select name="productId" required className="h-12 rounded border px-3">{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.cylinderSize}</option>)}</select></label>
          <input name="fullDelta" type="number" step="1" defaultValue="0" aria-label="Full cylinder adjustment" className="h-12 rounded border px-3" />
          <input name="emptyDelta" type="number" step="1" defaultValue="0" aria-label="Empty cylinder adjustment" className="h-12 rounded border px-3" />
          <input name="reason" required minLength={5} placeholder="Reason for adjustment" className="h-12 rounded border px-3 md:col-span-2" />
          <button type="submit" className="ui-btn ui-btn-primary md:col-span-2">Record Audited Adjustment</button>
        </form>
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Branch</th><th className="p-3">Product</th><th className="p-3">Full</th><th className="p-3">Empty</th></tr></thead>
            <tbody>{balances.map((balance) => <tr key={balance.id} className="border-b"><td className="p-3">{balance.branch.name}</td><td className="p-3">{balance.product.name}</td><td className="p-3 font-black">{balance.fullCount}</td><td className="p-3 font-black">{balance.emptyCount}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
