import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { CylinderForm } from "./CylinderForm";
import { logCylinderEvent } from "./actions";

export const dynamic = "force-dynamic";

export default async function CylindersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "ADMIN") redirect("/admin-console");

  const [cylinders, branches, products] = await Promise.all([
    prisma.cylinder.findMany({
      include: { product: true, branch: true, customer: true, events: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto max-w-screen-xl flex flex-col gap-6">
        <PageHeader
          eyebrow="Admin"
          title="Cylinder Serial Tracking"
          description="Register individual cylinders by serial and track their movement. This is additive — the existing count-based inventory flow is unchanged."
        />

        <Card>
          <CardHeader title="Register a Cylinder" description="Serial + product + branch. Duplicate serials per branch are updated, not duplicated." />
          <CylinderForm branches={branches} products={products} />
        </Card>

        <Card>
          <CardHeader title={`Registered Cylinders (${cylinders.length})`} description="Most recent first." />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Product</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Customer</th>
                  <th>Last Event</th>
                </tr>
              </thead>
              <tbody>
                {cylinders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={7}>
                      No cylinders registered yet.
                    </td>
                  </tr>
                ) : (
                  cylinders.map((c) => (
                    <tr key={c.id}>
                      <td className="is-strong">{c.serial}</td>
                      <td>{c.product.name}</td>
                      <td>{c.branch.name}</td>
                      <td><Badge tone={c.status === "OUT" ? "warning" : c.status === "RETURNED" ? "brand" : c.status === "RETIRED" ? "slate" : c.status === "FILLED" ? "info" : "success"}>{c.status.replaceAll("_", " ")}</Badge></td>
                      <td>{c.location ?? "—"}</td>
                      <td>{c.customer?.name ?? "—"}</td>
                      <td className="whitespace-nowrap text-xs">{c.events[0] ? `${c.events[0].type.replaceAll("_", " ")}` : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Log a Cylinder Event" description="Record a movement (load / sale / return / adjustment) for a tracked cylinder." />
          <form action={logCylinderEvent} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select name="cylinderId" className="ui-input" defaultValue="">
              <option value="">Select cylinder…</option>
              {cylinders.map((c) => (
                <option key={c.id} value={c.id}>{c.serial} — {c.product.name}</option>
              ))}
            </select>
            <select name="type" className="ui-input" defaultValue="STOCK_ADJUSTMENT">
              <option value="DAILY_LOAD_FULL">Daily Load (Full)</option>
              <option value="SALE_FULL_DELIVERED">Sale Delivered (Full)</option>
              <option value="CUSTOMER_EMPTY_RETURNED">Customer Empty Returned</option>
              <option value="DAILY_RETURN_FULL">Daily Return (Full)</option>
              <option value="DAILY_RETURN_EMPTY">Daily Return (Empty)</option>
              <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
            </select>
            <select name="status" className="ui-input" defaultValue="AVAILABLE">
              <option value="AVAILABLE">Available</option>
              <option value="FILLED">Filled</option>
              <option value="OUT">Out</option>
              <option value="RETURNED">Returned</option>
              <option value="RETIRED">Retired</option>
            </select>
            <input name="note" placeholder="Note (optional)" className="ui-input" />
            <button type="submit" className="ui-btn ui-btn-primary md:col-span-4">Log Event</button>
          </form>
        </Card>
      </div>
    </main>
  );
}
