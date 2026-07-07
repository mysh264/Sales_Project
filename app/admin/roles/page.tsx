import Link from "next/link";
import { redirect } from "next/navigation";
import { createRole, updateRole } from "@/app/actions/roles";
import { PermissionChecklist } from "@/app/admin/roles/PermissionChecklist";
import { getCurrentUser } from "@/lib/session";
import { normalizePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RolesPageProps = {
  searchParams?: Promise<{
    editId?: string;
    cloneFrom?: string;
  }>;
};

function parseSelectedRoleId(params: { editId?: string; cloneFrom?: string }) {
  return params.editId?.trim() || params.cloneFrom?.trim() || "";
}

export default async function RolesPage({ searchParams }: RolesPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN") {
    redirect("/admin");
  }

  const params = (await searchParams) ?? {};
  const selectedRoleId = parseSelectedRoleId(params);

  const roles = await prisma.role.findMany({
    include: {
      users: {
        select: { id: true },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const selectedRole = selectedRoleId ? roles.find((role) => role.id === selectedRoleId) ?? null : null;
  const isEditMode = Boolean(params.editId && selectedRole);
  const formAction = isEditMode ? updateRole : createRole;
  const editorKey = `${isEditMode ? "edit" : selectedRole ? "clone" : "create"}:${selectedRole?.id ?? "blank"}`;
  const defaultRoleName = selectedRole ? (isEditMode ? selectedRole.name : `${selectedRole.name} Copy`) : "";

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Admin / Roles</p>
            <h1 className="text-3xl font-black text-slate-950">Role Management</h1>
            <p className="mt-2 text-sm font-bold text-slate-600">
              Define permission bundles, clone existing roles, and keep access rules readable for operations.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Back to Admin
            </Link>
            <Link href="/admin/roles" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Refresh
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.4fr]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-black text-slate-950">Defined Roles</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Permissions</th>
                    <th className="px-4 py-2">Users</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="font-black text-slate-950">{role.name}</div>
                        <div className="text-xs font-bold text-slate-500">{role.id}</div>
                      </td>
                      <td className="px-4 py-2 font-bold text-slate-700">{role.permissions.length}</td>
                      <td className="px-4 py-2 font-bold text-slate-700">{role.users.length}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/roles?editId=${role.id}`}
                            className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-900"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/admin/roles?cloneFrom=${role.id}`}
                            className="rounded bg-slate-900 px-3 py-2 text-xs font-black text-white"
                          >
                            Clone
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={4}>
                        No roles defined yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div key={editorKey} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  {isEditMode ? "Edit Role" : selectedRole ? "Clone Role" : "Create Role"}
                </h2>
                <p className="text-xs font-bold text-slate-500">
                  {selectedRole
                    ? `Loaded from ${selectedRole.name}. Adjust the name or permissions before saving.`
                    : "Create a new permission bundle with the exact access it needs."}
                </p>
              </div>
              {selectedRole ? (
                <Link href="/admin/roles" className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-900">
                  Clear
                </Link>
              ) : null}
            </div>

            <form key={editorKey} action={formAction} className="mt-6 space-y-6">
              {isEditMode && selectedRole ? <input type="hidden" name="roleId" value={selectedRole.id} /> : null}

              <label className="block">
                <span className="text-sm font-black text-slate-700">Role Name</span>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={defaultRoleName}
                  className="mt-2 h-12 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
                />
              </label>

              <div>
                <div className="mb-3">
                  <span className="text-sm font-black text-slate-700">Permissions</span>
                  <p className="text-xs font-bold text-slate-500">Select the capabilities this role should grant.</p>
                </div>
                <PermissionChecklist selected={normalizePermissions(selectedRole?.permissions ?? [])} autoSubmit={isEditMode} />
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="rounded bg-slate-950 px-5 py-3 text-sm font-black text-white">
                  {isEditMode ? "Save Changes" : "Create Role"}
                </button>
                {selectedRole ? (
                  <Link href="/admin/roles" className="rounded border border-slate-300 px-5 py-3 text-sm font-black text-slate-900">
                    New Blank Role
                  </Link>
                ) : null}
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
