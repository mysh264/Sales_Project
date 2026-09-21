import { UserRole } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { createUser, toggleGlobalSalesView, toggleUserStatus, updateUserRole } from "@/app/actions/users";
import { resetUserPassword } from "@/app/actions/security";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import RoleBranchEditor from "@/components/BranchSelect";
import EmployeeEditPanel from "@/components/EmployeeEditPanel";

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
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto max-w-screen-2xl animate-fade-in">
        <PageHeader
          eyebrow="System Administration"
          title="Admin Console"
          description="Full system control. Admin can view and edit users, roles, branches, and operational access."
          actions={
            <>
              <ButtonLink href="/admin/branches" variant="ghost">Branches</ButtonLink>
              <ButtonLink href="/admin/products" variant="ghost">Products</ButtonLink>
              <ButtonLink href="/admin/roles" variant="ghost">Roles</ButtonLink>
              <ButtonLink href="/admin/audit-logs" variant="ghost">Audit Logs</ButtonLink>
              <ButtonLink href="/admin/cylinders" variant="ghost">Cylinders</ButtonLink>
              <ButtonLink href="/admin/finance" variant="ghost">Finance</ButtonLink>
              <ButtonLink href="/admin/reconciliation" variant="ghost">Reconciliation</ButtonLink>
            </>
          }
        />

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Total Users" value={userCount} />
          <Stat label="Active Users" value={activeUsers} tone="success" />
          <Stat label="Branches" value={branchCount} />
          <Stat label="Invoices" value={invoiceCount} />
        </section>

        <Card className="mt-6">
          <CardHeader title="Create Employee" description="Add a new team member and assign their role, branch and permission profile." />
          <form action={createUser} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="ui-label">Full Name</span>
              <input name="fullName" required className="ui-input" />
            </label>
            <label className="block">
              <span className="ui-label">Phone</span>
              <input name="phone" className="ui-input" />
            </label>
            <label className="block">
              <span className="ui-label">Email</span>
              <input name="email" type="email" required className="ui-input" />
            </label>
            <label className="block">
              <span className="ui-label">Password</span>
              <input name="password" type="password" minLength={12} required className="ui-input" />
            </label>
            <div className="block">
              <span className="ui-label">Role &amp; Branch</span>
              <RoleBranchEditor
                nameRole="role"
                nameBranch="branchId"
                roles={roleOptions}
                branches={branches}
                defaultRole="SALESMAN"
                required
              />
            </div>
            <label className="block">
              <span className="ui-label">Permission Profile</span>
              <select name="roleId" defaultValue="" className="ui-input">
                <option value="">Use default profile</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-3">
              <button type="submit" className="ui-btn ui-btn-primary">
                Create Employee
              </button>
            </div>
          </form>
        </Card>

        <Card className="mt-6 overflow-hidden p-0">
          <CardHeader title="Employee Directory" description="Manage roles, branches and access for every team member." />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Contact</th>
                  <th>Global Sales</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <p className="font-black text-slate-950">{user.fullName}</p>
                      <p className="text-xs font-semibold text-slate-500">{user.email ?? "No email"}</p>
                    </td>
                    <td>
                      <Badge tone="slate">{user.roleProfile?.name ?? roleLabel(user.role)}</Badge>
                    </td>
                    <td className="font-semibold text-slate-700">{user.branch?.code ?? "No Branch"}</td>
                    <td className="font-semibold text-slate-700">{user.phone ?? "No phone"}</td>
                    <td>
                      {user.id === currentUser.id ? (
                        <span className="ui-badge ui-badge-slate">Protected Admin</span>
                      ) : (
                        <form action={toggleGlobalSalesView}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="currentStatus" value={String(user.allowGlobalSalesView)} />
                          <button
                            type="submit"
                            className={`ui-badge ${user.allowGlobalSalesView ? "ui-badge-brand" : "ui-badge-slate"} cursor-pointer hover:opacity-80`}
                          >
                            {user.allowGlobalSalesView ? "Enabled" : "Disabled"}
                          </button>
                        </form>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-2">
                        {user.id === currentUser.id ? (
                          <span className="ui-badge ui-badge-slate">Current Account</span>
                        ) : (
                          <>
                            <form action={toggleUserStatus}>
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="currentStatus" value={String(user.isActive)} />
                              <button type="submit" className="ui-btn ui-btn-danger ui-btn-sm">
                                {user.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </form>
                            <EmployeeEditPanel
                              user={user}
                              roleOptions={roleOptions}
                              branches={branches}
                              roles={roles}
                              updateUserRole={updateUserRole}
                              resetUserPassword={resetUserPassword}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
