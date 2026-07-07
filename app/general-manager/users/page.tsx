import { UserRole } from "@prisma/client";
import Link from "next/link";
import { createUser, toggleGlobalSalesView, toggleUserStatus, updateUserRole } from "@/app/actions/users";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const roleOptions = Object.values(UserRole);

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ");
}

function roleBadgeClass(role: UserRole) {
  switch (role) {
    case "GENERAL_MANAGER":
      return "bg-purple-100 text-purple-800";
    case "MANAGER":
    case "ACCOUNTANT_MANAGER":
      return "bg-blue-100 text-blue-800";
    case "ACCOUNTANT":
      return "bg-cyan-100 text-cyan-800";
    case "LOADER":
      return "bg-orange-100 text-orange-800";
    case "SALESMAN":
      return "bg-green-100 text-green-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export default async function GeneralManagerUsersPage() {
  const [users, branches, roles] = await Promise.all([
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
  ]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">General Manager</p>
            <h1 className="text-3xl font-black text-slate-950">User Management</h1>
          </div>
          <Link href="/general-manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
            Back to Global Dashboard
          </Link>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Add Employee</h2>
          </div>
          <form action={createUser} className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-sm font-black text-slate-700">Full Name</span>
              <input
                name="fullName"
                type="text"
                required
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">Phone</span>
              <input
                name="phone"
                type="tel"
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                required
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">Password</span>
              <input
                name="password"
                type="password"
                minLength={8}
                required
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">Role</span>
              <select
                name="role"
                required
                defaultValue="SALESMAN"
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
                </select>
              </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">Permission Profile</span>
              <select
                name="roleId"
                defaultValue=""
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              >
                <option value="">Use default profile for selected role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">Branch</span>
              <select
                name="branchId"
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              >
                <option value="">No Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end lg:col-span-3">
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
                      <p className="text-xs font-bold text-slate-500">{user.id}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className={`rounded px-2 py-1 text-xs font-black uppercase ${roleBadgeClass(user.role)}`}>
                        {user.roleProfile?.name ?? roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-700">
                      {user.branch?.name ?? "No Branch"}
                    </td>
                    <td className="px-4 py-2">
                      <p className="font-bold text-slate-900">{user.email ?? "No email"}</p>
                      <p className="text-xs font-bold text-slate-500">{user.phone ?? "No phone"}</p>
                    </td>
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
                        <form action={updateUserRole} className="flex gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select
                            name="newRole"
                            defaultValue={user.role}
                            className="h-9 rounded border border-slate-300 px-2 text-xs font-bold outline-none focus:border-slate-950"
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </select>
                          <select
                            name="newBranchId"
                            defaultValue={user.branchId ?? ""}
                            className="h-9 rounded border border-slate-300 px-2 text-xs font-bold outline-none focus:border-slate-950"
                          >
                            <option value="">No Branch</option>
                            {branches.map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {branch.code}
                              </option>
                            ))}
                          </select>
                          <select
                            name="newRoleId"
                            defaultValue={user.roleId ?? ""}
                            className="h-9 rounded border border-slate-300 px-2 text-xs font-bold outline-none focus:border-slate-950"
                          >
                            <option value="">Built-in profile</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="h-9 rounded bg-slate-900 px-3 text-xs font-black text-white">
                            Update
                          </button>
                        </form>

                        <form action={toggleUserStatus}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="currentStatus" value={String(user.isActive)} />
                          <button
                            type="submit"
                            className={`h-9 rounded px-3 text-xs font-black text-white ${
                              user.isActive ? "bg-red-700" : "bg-green-700"
                            }`}
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={7}>
                      No users found.
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
