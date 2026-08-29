"use server";

import { Prisma, UserRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { logAction, auditSnapshot } from "@/lib/audit";
import { DEFAULT_ROLE_PERMISSIONS, Permissions, canAssignProfile, getEffectivePermissions, normalizePermissions, type Permission } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { getBranchScope, requireBranchAccess } from "@/lib/branch-scope";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseRole(value: string) {
  if (value in UserRole) {
    return value as UserRole;
  }

  throw new Error("Invalid user role.");
}

async function resolvePermissionProfileId(
  tx: Prisma.TransactionClient,
  role: UserRole,
  roleId: string | null,
  actorRole: UserRole,
  actorPermissions: Permission[],
) {
  if (roleId) {
    const customRole = await tx.role.findUnique({ where: { id: roleId } });
    if (!customRole) {
      throw new Error("Selected permission profile was not found.");
    }
    const profilePermissions = normalizePermissions(customRole.permissions);
    if (!canAssignProfile(actorRole, actorPermissions, profilePermissions)) {
      throw new Error("You cannot assign a permission profile containing permissions you do not have.");
    }

    return customRole.id;
  }

  const builtInRole = await tx.role.upsert({
    where: { name: role },
    update: {
      permissions: DEFAULT_ROLE_PERMISSIONS[role],
    },
    create: {
      name: role,
      permissions: DEFAULT_ROLE_PERMISSIONS[role],
    },
  });

  return builtInRole.id;
}

function requireRoleManagement(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "ADMIN") return;
  if (actorRole === "GENERAL_MANAGER" && targetRole !== "ADMIN") return;
  if (
    actorRole === "MANAGER" &&
    (targetRole === "LOADER" || targetRole === "SALESMAN")
  ) return;
  throw new Error("You cannot assign or manage this account type.");
}

export async function createUser(formData: FormData) {
  const fullName = text(formData, "fullName");
  const phone = text(formData, "phone");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const role = parseRole(text(formData, "role"));
  // ADMIN and GENERAL_MANAGER are global roles; a branch assignment is meaningless for them
  // (the app always treats them as global via hasGlobalSalesAccess) and only causes confusion.
  const branchId = (role === "ADMIN" || role === "GENERAL_MANAGER") ? null : (text(formData, "branchId") || null);
  const roleId = text(formData, "roleId") || null;

  if (!fullName || !email || !password) {
    throw new Error("Full name, email, and password are required.");
  }

  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { user: actor } = await requirePermission(Permissions.Users_Update);
  const scope = await getBranchScope();
  requireRoleManagement(actor.role, role);
  if (branchId) {
    requireBranchAccess(scope, branchId);
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  }

  await prisma.$transaction(async (tx) => {
    const permissionProfileId = await resolvePermissionProfileId(tx, role, roleId, actor.role, getEffectivePermissions(actor));
    const user = await tx.user.create({
      data: {
        fullName,
        phone: phone || null,
        email,
        passwordHash,
        role,
        branchId,
        roleId: permissionProfileId,
        isActive: true,
        hasGlobalAccess: false,
        allowGlobalSalesView: false,
      },
    });

    await logAction(
      actor.id,
      "CREATE_USER",
      "User",
      user.id,
      null,
      auditSnapshot({
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
        branchId: user.branchId,
        isActive: user.isActive,
        hasGlobalAccess: user.hasGlobalAccess,
        allowGlobalSalesView: user.allowGlobalSalesView,
      }),
      { tx },
    );

  });

  revalidatePath("/general-manager/users");
  revalidatePath("/manager/users");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function toggleUserStatus(formData: FormData) {
  const userId = text(formData, "userId");
  const currentStatus = text(formData, "currentStatus") === "true";

  if (!userId) {
    throw new Error("Missing user.");
  }

  const { user: actor } = await requirePermission(Permissions.Users_Update);
  const scope = await getBranchScope();

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.id === actor.id) {
      throw new Error("You cannot deactivate your own account.");
    }
    requireRoleManagement(actor.role, user.role);
    if (user.branchId) requireBranchAccess(scope, user.branchId);
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { isActive: !currentStatus, sessionVersion: { increment: 1 } },
    });

    await logAction(
      actor.id,
      "UPDATE_USER_STATUS",
      "User",
      userId,
      auditSnapshot(user),
      auditSnapshot(updatedUser),
      { tx },
    );
  });

  revalidatePath("/general-manager/users");
  revalidatePath("/manager/users");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function updateUserRole(formData: FormData) {
  const userId = text(formData, "userId");
  const role = parseRole(text(formData, "newRole"));
  // ADMIN and GENERAL_MANAGER are global roles; never scope them to a branch.
  const branchId = (role === "ADMIN" || role === "GENERAL_MANAGER") ? null : (text(formData, "newBranchId") || null);
  const roleId = text(formData, "newRoleId") || null;

  if (!userId) {
    throw new Error("Missing user.");
  }

  const { user: actor } = await requirePermission(Permissions.Users_Update);
  const scope = await getBranchScope();
  if (userId === actor.id && role !== UserRole.ADMIN) {
    throw new Error("You cannot remove your own administrator role.");
  }
  requireRoleManagement(actor.role, role);
  if (branchId) {
    requireBranchAccess(scope, branchId);
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    requireRoleManagement(actor.role, user.role);
    if (user.branchId) requireBranchAccess(scope, user.branchId);
    const permissionProfileId = await resolvePermissionProfileId(tx, role, roleId, actor.role, getEffectivePermissions(actor));
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        role,
        branchId,
        roleId: permissionProfileId,
        sessionVersion: { increment: 1 },
      },
    });

    await logAction(
      actor.id,
      "UPDATE_PERMISSION",
      "User",
      userId,
      auditSnapshot(user),
      auditSnapshot(updatedUser),
      { tx },
    );
  });

  revalidatePath("/general-manager/users");
  revalidatePath("/manager/users");
  revalidatePath("/admin/users");
  revalidatePath("/manager");
  revalidatePath("/loader");
  revalidatePath("/admin");
}

export async function toggleGlobalSalesView(formData: FormData) {
  const userId = text(formData, "userId");
  const currentStatus = text(formData, "currentStatus") === "true";

  if (!userId) {
    throw new Error("Missing user.");
  }

  const { user: actor } = await requirePermission(Permissions.Users_Update);
  if (actor.role !== "ADMIN" && actor.role !== "GENERAL_MANAGER") {
    throw new Error("Only administrators and general managers can grant global access.");
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    requireRoleManagement(actor.role, user.role);
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        hasGlobalAccess: !currentStatus,
        allowGlobalSalesView: !currentStatus,
        sessionVersion: { increment: 1 },
      },
    });

    await logAction(
      actor.id,
      "UPDATE_PERMISSION",
      "User",
      userId,
      auditSnapshot(user),
      auditSnapshot(updatedUser),
      { tx },
    );
  });

  revalidatePath("/general-manager/users");
  revalidatePath("/manager/users");
  revalidatePath("/admin/users");
  revalidatePath("/manager");
  revalidatePath("/admin");
}
