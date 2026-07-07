import { UserRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createUser, toggleGlobalSalesView, toggleUserStatus, updateUserRole } from "@/app/actions/users";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const roleOptions = Object.values(UserRole);

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ");
}

export default async function AdminConsolePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN") {
    redirect("/admin");
  }

  const [users, branches, roles, userCount, branchCount, invoiceCount, activeUsers] = await Promise.all([
    prisma.user.findMany({
      include: { branch: true, roleProfile: true },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    }),
    prisma.branch.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.user.count(),
    prisma.branch.count(),
    prisma.invoice.count(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">System Administration</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Admin Console</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Full system control. Admin can view and edit users, roles, branches, and operational access.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Home
              </Link>
              <Link href="/admin/branches" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
                Branches
              </Link>
              <Link href="/admin/products" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
                Products
              </Link>
              <Link href="/admin/roles" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
                Roles
              </Link>
              <Link href="/admin/audit-logs" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
                Audit Logs
              </Link>
              <Link href="/general-manager/users" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
                User Management
              </Link>
              <Link href="/admin/products" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950">
                Product Master
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: "Total Users", value: userCount },
            { label: "Active Users", value: activeUsers },
            { label: "Branches", value: branchCount },
            { label: "Invoices", value: invoiceCount },
          ].map((card) => (
            <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Create Employee</h2>
          </div>
          <form action={createUser} className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="text-sm font-black text-slate-700">Full Name</span>
              <input name="fullName" required className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Phone</span>
              <input name="phone" className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Email</span>
              <input name="email" type="email" required className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Password</span>
              <input name="password" type="password" minLength={8} required className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Role</span>
              <select name="role" defaultValue="SALESMAN" className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold">
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Permission Profile</span>
              <select name="roleId" defaultValue="" className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold">
                <option value="">Use default profile</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Branch</span>
              <select name="branchId" defaultValue="" className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold">
                <option value="">No Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-3">
              <button type="submit" className="h-11 rounded bg-slate-950 px-5 text-sm font-black text-white">
                Create Employee
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Employee Directory</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Branch</th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Global Sales</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <p className="font-black text-slate-950">{user.fullName}</p>
                      <p className="text-xs font-bold text-slate-500">{user.email ?? "No email"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-black uppercase text-slate-800">
                        {user.roleProfile?.name ?? roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">
                      {user.branch?.code ?? "No Branch"}
                    </td>
                    <td className="px-4 py-2 font-bold text-slate-700">{user.phone ?? "No phone"}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <form action={toggleGlobalSalesView}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="currentStatus" value={String(user.hasGlobalAccess ?? user.allowGlobalSalesView)} />
                        <button
                          type="submit"
                          className={`rounded px-3 py-2 text-xs font-black text-white ${
                            (user.hasGlobalAccess ?? user.allowGlobalSalesView) ? "bg-indigo-700" : "bg-slate-500"
                          }`}
                        >
                          {(user.hasGlobalAccess ?? user.allowGlobalSalesView) ? "Enabled" : "Disabled"}
                        </button>
                      </form>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-black uppercase ${
                          user.isActive ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <form action={toggleUserStatus}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="currentStatus" value={String(user.isActive)} />
                          <button type="submit" className="rounded bg-red-700 px-3 py-2 text-xs font-black text-white">
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        <form action={updateUserRole} className="flex gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select name="newRole" defaultValue={user.role} className="h-9 rounded border border-slate-300 px-2 text-xs font-bold">
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </select>
                          <select name="newBranchId" defaultValue={user.branchId ?? ""} className="h-9 rounded border border-slate-300 px-2 text-xs font-bold">
                            <option value="">No Branch</option>
                            {branches.map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {branch.code}
                              </option>
                            ))}
                          </select>
                          <select name="newRoleId" defaultValue={user.roleId ?? ""} className="h-9 rounded border border-slate-300 px-2 text-xs font-bold">
                            <option value="">Built-in profile</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="h-9 rounded bg-slate-900 px-3 text-xs font-black text-white">
                            Save
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
