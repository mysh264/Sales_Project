import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permission-guard";
import { Permissions } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function AdminConsolePage() {
  await requirePermission(Permissions.Users_Read);
  const [userCount, activeUsers, branchCount, productCount, invoiceCount, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.branch.count(),
    prisma.product.count(),
    prisma.invoice.count(),
    prisma.user.findMany({
      include: { branch: true },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    }),
  ]);

  const cards = [
    { label: "Total Users", value: userCount, tone: "default" as const },
    { label: "Active Users", value: activeUsers, tone: "success" as const },
    { label: "Branches", value: branchCount, tone: "default" as const },
    { label: "Products", value: productCount, tone: "default" as const },
    { label: "Invoices", value: invoiceCount, tone: "default" as const },
  ];

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow="System Administration"
          title="Admin Console"
          description="System health, role audit, and master user visibility."
          actions={
            <>
              <ButtonLink href="/admin/branches" variant="ghost">Branches</ButtonLink>
              <ButtonLink href="/admin/products" variant="ghost">Products</ButtonLink>
              <ButtonLink href="/admin/roles" variant="ghost">Roles</ButtonLink>
              <ButtonLink href="/admin/audit-logs" variant="primary">Audit Logs</ButtonLink>
            </>
          }
        />

        <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {cards.map((card) => (
            <Stat key={card.label} label={card.label} value={card.value} tone={card.tone} />
          ))}
        </section>

        <Card className="overflow-hidden p-0">
          <CardHeader title="Master User Management" description="Quick view of every team member and their branch." />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="is-strong">{user.fullName}</td>
                    <td className="font-semibold text-slate-600">{user.email ?? "No email"}</td>
                    <td className="font-semibold text-slate-700">{user.role.replaceAll("_", " ")}</td>
                    <td className="font-semibold text-slate-700">{user.branch?.name ?? "System"}</td>
                    <td>
                      <span className={`ui-badge ${user.isActive ? "ui-badge-success" : "ui-badge-slate"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="System Logs" description="Application logs are available through Docker with the sales_nextjs container logs." />
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/admin/audit-logs" variant="primary">Open Audit Logs</ButtonLink>
            <ButtonLink href="/admin/products" variant="ghost">Manage Products</ButtonLink>
            <ButtonLink href="/admin/roles" variant="ghost">Manage Roles</ButtonLink>
          </div>
        </Card>
      </div>
    </main>
  );
}
