"use client";

import { useState } from "react";
import { UserRole } from "@/generated/prisma/client";
import RoleBranchEditor from "@/components/BranchSelect";

type BranchOption = { id: string; code: string; name: string };
type RoleProfile = { id: string; name: string };

export default function EmployeeEditPanel({
  user,
  roleOptions,
  branches,
  roles,
  updateUserRole,
  resetUserPassword,
}: {
  user: { id: string; role: UserRole; branchId: string | null; roleId: string | null };
  roleOptions: UserRole[];
  branches: BranchOption[];
  roles: RoleProfile[];
  updateUserRole: (formData: FormData) => void;
  resetUserPassword: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ui-btn ui-btn-ghost ui-btn-sm"
        aria-expanded={open}
      >
        {open ? "Close" : "Edit"}
      </button>

      {open && (
        <div className="relative mt-2 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <form action={updateUserRole} className="flex flex-wrap items-center gap-2 pr-8">
            <input type="hidden" name="userId" value={user.id} />
            <RoleBranchEditor
              nameRole="newRole"
              nameBranch="newBranchId"
              roles={roleOptions}
              branches={branches}
              defaultRole={user.role}
              defaultBranchId={user.branchId}
              compact
            />
            <select name="newRoleId" defaultValue={user.roleId ?? ""} className="ui-input h-9 w-36 px-2 text-xs">
              <option value="">Built-in profile</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm">
              Save
            </button>
          </form>

          <form action={resetUserPassword} className="flex items-center gap-2 pr-8">
            <input type="hidden" name="userId" value={user.id} />
            <input
              name="newPassword"
              type="password"
              required
              minLength={12}
              placeholder="New password"
              className="ui-input h-9 w-36 px-2 text-xs"
            />
            <button type="submit" className="ui-btn ui-btn-ghost ui-btn-sm">
              Reset
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
