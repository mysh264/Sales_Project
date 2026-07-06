import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminConsolePage() {
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
    { label: "Total Users", value: userCount },
    { label: "Active Users", value: activeUsers },
    { label: "Branches", value: branchCount },
    { label: "Products", value: productCount },
    { label: "Invoices", value: invoiceCount },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">System Administration</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Admin Console</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">
            System health, role audit, and master user visibility.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {cards.map((card) => (
            <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Master Data</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">
            Manage branches, products, roles, and audit trails from one place.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/branches" className="inline-flex rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Branches
            </Link>
            <Link href="/admin/products" className="inline-flex rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Products
            </Link>
            <Link href="/admin/roles" className="inline-flex rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Roles
            </Link>
            <Link href="/admin/audit-logs" className="inline-flex rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Audit Logs
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Master User Management</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Branch</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-black text-slate-950">{user.fullName}</td>
                    <td className="px-4 py-2 font-bold text-slate-700">{user.email ?? "No email"}</td>
                    <td className="px-4 py-2 font-bold text-slate-900">{user.role.replaceAll("_", " ")}</td>
                    <td className="px-4 py-2 font-bold text-slate-700">{user.branch?.name ?? "System"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-black uppercase ${
                          user.isActive ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">System Logs</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">
            Application logs are currently available through Docker with <span className="font-mono">docker logs sales_nextjs</span>.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/audit-logs" className="inline-flex rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Open Audit Logs
            </Link>
            <Link href="/admin/products" className="inline-flex rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Manage Products
            </Link>
            <Link href="/admin/roles" className="inline-flex rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Manage Roles
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
