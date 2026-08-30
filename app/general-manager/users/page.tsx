import { UserRole } from "@/generated/prisma/client";
import { createUser, toggleGlobalSalesView, toggleUserStatus, updateUserRole } from "@/app/actions/users";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permission-guard";
import { Permissions } from "@/lib/permissions";
import { getBranchScope } from "@/lib/branch-scope";
import { getCurrentUser } from "@/lib/session";
import { resetUserPassword } from "@/app/actions/security";
import { getEffectivePermissions, normalizePermissions } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import RoleBranchEditor from "@/components/BranchSelect";
import EmployeeEditPanel from "@/components/EmployeeEditPanel";

export const dynamic = "force-dynamic";

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ");
}

function badgeTone(role: UserRole): "slate" | "brand" | "info" | "warning" | "success" {
  switch (role) {
    case "GENERAL_MANAGER":
      return "brand";
    case "MANAGER":
      return "info";
    case "LOADER":
      return "warning";
    case "SALESMAN":
      return "success";
    default:
      return "slate";
  }
}

export default async function GeneralManagerUsersPage() {
  await requirePermission(Permissions.Users_Update);
  const currentUser = await getCurrentUser();
  const scope = await getBranchScope();
  const isManager = currentUser?.role === "MANAGER";
  const actorPermissionSet = new Set(getEffectivePermissions(currentUser));
  const roleOptions =
    currentUser?.role === "ADMIN"
      ? Object.values(UserRole)
      : currentUser?.role === "GENERAL_MANAGER"
        ? Object.values(UserRole).filter((role) => role !== "ADMIN")
        : [UserRole.LOADER, UserRole.SALESMAN];
  const [users, branches, allRoles, auditEntries] = await Promise.all([
    prisma.user.findMany({
      where: scope?.canSeeAllBranches ? undefined : { branchId: scope?.branchId ?? "__no_branch__" },
      include: { branch: true, roleProfile: true },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    }),
    prisma.branch.findMany({
      where: scope?.canSeeAllBranches ? undefined : { id: scope?.branchId ?? "__no_branch__" },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        targetModel: "User",
        action: { in: ["CREATE_USER", "UPDATE_PERMISSION", "UPDATE_USER_STATUS"] },
      },
      orderBy: { timestamp: "desc" },
      select: { targetId: true, userId: true, action: true, timestamp: true, user: { select: { fullName: true } } },
    }),
  ]);
  const roles = allRoles.filter((role) =>
    normalizePermissions(role.permissions).every((permission) => actorPermissionSet.has(permission)),
  );

  const createdBy = new Map<string, string>();
  const lastModifiedBy = new Map<string, string>();
  for (const entry of auditEntries) {
    const name = entry.user?.fullName ?? "Unknown";
    if (entry.action === "CREATE_USER" && !createdBy.has(entry.targetId)) {
      createdBy.set(entry.targetId, name);
    }
    if (!lastModifiedBy.has(entry.targetId)) {
      lastModifiedBy.set(entry.targetId, name);
    }
  }

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow={isManager ? "Branch Manager" : "General Manager"}
          title="User Management"
          description={
            isManager
              ? "Manage loaders and salespeople assigned to your branch."
              : "Manage employees and their access."
          }
          actions={
            <ButtonLink href={isManager ? "/manager" : "/general-manager"} variant="ghost">
              Back to Dashboard
            </ButtonLink>
          }
        />

        <Card>
          <CardHeader title="Add Employee" description="Create a team member and assign their role, branch and permission profile." />
          <form action={createUser} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="ui-label">Full Name</span>
              <input name="fullName" type="text" required className="ui-input" />
            </label>
            <label className="block">
              <span className="ui-label">Phone</span>
              <input name="phone" type="tel" className="ui-input" />
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
                <option value="">Use default profile for selected role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end lg:col-span-3">
              <button type="submit" className="ui-btn ui-btn-primary">
                Create Employee
              </button>
            </div>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
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
                {users.map((user) => {
                  const globalOn = Boolean(user.hasGlobalAccess ?? user.allowGlobalSalesView);
                  return (
                    <tr key={user.id}>
                      <td className="is-strong">{user.fullName}</td>
                      <td>
                        <Badge tone={badgeTone(user.role)}>{user.roleProfile?.name ?? roleLabel(user.role)}</Badge>
                      </td>
                      <td className="font-semibold text-slate-700">{user.branch?.name ?? "No Branch"}</td>
                      <td className="font-semibold text-slate-600">
                        <p className="font-bold text-slate-900">{user.email ?? "No email"}</p>
                        <p className="text-xs font-bold text-slate-500">{user.phone ?? "No phone"}</p>
                      </td>
                      <td>
                        {isManager ? (
                          <span className="ui-badge ui-badge-slate">Managed centrally</span>
                        ) : (
                          <form action={toggleGlobalSalesView}>
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="currentStatus" value={String(globalOn)} />
                            <button
                              type="submit"
                              className={`ui-badge ${globalOn ? "ui-badge-brand" : "ui-badge-slate"} cursor-pointer hover:opacity-80`}
                            >
                              {globalOn ? "Enabled" : "Disabled"}
                            </button>
                          </form>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-2">
                          {user.id === currentUser?.id ? (
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
                  );
                })}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={7}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
