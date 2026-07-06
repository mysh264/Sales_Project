import type { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { Permissions, getEffectivePermissions, type Permission } from "@/lib/permissions";

type AuditClient = {
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

type PermissionGuardContext = {
  tx?: AuditClient;
  targetModel?: string;
  targetId?: string;
  reason?: string;
};

export function checkPermission(
  user:
    | {
        id: string;
        role: UserRole;
        roleProfile?: { permissions: string[] } | null;
      }
    | null
    | undefined,
  requiredPermission: Permission,
) {
  if (!user) {
    return false;
  }

  const permissions = getEffectivePermissions(user);
  return user.role === "ADMIN" || permissions.includes(requiredPermission);
}

export async function requirePermission(permission: Permission, context?: PermissionGuardContext) {
  const currentUser = await getCurrentUser();

  if (currentUser && checkPermission(currentUser, permission)) {
    return { user: currentUser, permissions: getEffectivePermissions(currentUser) };
  }

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  await logAction(
    currentUser.id,
    Permissions.SECURITY_BREACH,
    context?.targetModel ?? "PermissionGuard",
    context?.targetId ?? permission,
    null,
    {
      requiredPermission: permission,
      role: currentUser.role,
      permissions: getEffectivePermissions(currentUser),
      reason: context?.reason ?? "Permission denied",
    },
    { tx: context?.tx },
  );

  throw new Error("Unauthorized");
}
