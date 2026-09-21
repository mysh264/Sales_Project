"use client";

import { UserRole } from "@/generated/prisma/client";
import { useState } from "react";

const GLOBAL_ROLES: UserRole[] = ["ADMIN", "GENERAL_MANAGER"];

type Branch = { id: string; code: string; name: string };
type RoleOption = UserRole;

type Props = {
  nameRole: string;
  nameBranch: string;
  branches: Branch[];
  roles: RoleOption[];
  defaultRole: UserRole;
  defaultBranchId?: string | null;
  compact?: boolean;
  required?: boolean;
};

function roleLabel(role: string) {
  return role.replaceAll("_", " ");
}

export default function RoleBranchEditor({
  nameRole,
  nameBranch,
  branches,
  roles,
  defaultRole,
  defaultBranchId,
  compact,
  required,
}: Props) {
  const [role, setRole] = useState<UserRole>(defaultRole);
  const isGlobal = GLOBAL_ROLES.includes(role);
  const controlClass = compact
    ? "h-9 rounded border border-slate-300 px-2 text-xs font-bold"
    : "mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold";

  return (
    <>
      <select
        name={nameRole}
        defaultValue={defaultRole}
        className={controlClass}
        onChange={(e) => setRole(e.target.value as UserRole)}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>

      {isGlobal ? (
        <span
          className={`inline-flex items-center rounded border border-slate-300 bg-slate-100 px-2 text-xs font-bold text-slate-500 ${
            compact ? "h-9" : "mt-1 h-11 w-full px-3"
          }`}
          title="ADMIN and General Manager are global roles and are not tied to a branch."
        >
          Global role — no branch
        </span>
      ) : (
        <select
          name={nameBranch}
          defaultValue={defaultBranchId ?? ""}
          className={controlClass}
          required={required}
        >
          <option value="">No Branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code}
              {compact ? "" : ` · ${branch.name}`}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
