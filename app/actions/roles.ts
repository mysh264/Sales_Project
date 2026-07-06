"use server";

import { revalidatePath } from "next/cache";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions, assignablePermissions, normalizePermissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function permissionList(formData: FormData) {
  const values = formData.getAll("permissions").filter((value): value is string => typeof value === "string");

  return normalizePermissions(values).filter((value) => assignablePermissions.includes(value));
}

async function getActorId() {
  const { user } = await requirePermission(Permissions.Roles_Update);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user.id;
}

export async function createRole(formData: FormData) {
  const name = text(formData, "name").toUpperCase();
  const permissions = permissionList(formData);

  if (!name) {
    throw new Error("Role name is required.");
  }

  if (permissions.length === 0) {
    throw new Error("Select at least one permission.");
  }

  const actorId = await getActorId();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.role.findUnique({ where: { name } });

    if (existing) {
      throw new Error("A role with this name already exists. Use Edit for changes or choose a new name for a clone.");
    }

    const role = await tx.role.create({
      data: { name, permissions },
    });

    await logAction(actorId, "CREATE_ROLE", "Role", role.id, null, auditSnapshot(role), { tx });
  });

  revalidatePath("/admin/roles");
  revalidatePath("/general-manager/users");
  revalidatePath("/admin");
}

export async function updateRole(formData: FormData) {
  const roleId = text(formData, "roleId");
  const name = text(formData, "name").toUpperCase();
  const permissions = permissionList(formData);

  if (!roleId) {
    throw new Error("Missing role.");
  }

  if (!name) {
    throw new Error("Role name is required.");
  }

  if (permissions.length === 0) {
    throw new Error("Select at least one permission.");
  }

  const actorId = await getActorId();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.role.findUniqueOrThrow({ where: { id: roleId } });
    const role = await tx.role.update({
      where: { id: roleId },
      data: { name, permissions },
    });

    await logAction(actorId, "UPDATE_ROLE", "Role", role.id, auditSnapshot(existing), auditSnapshot(role), { tx });
  });

  revalidatePath("/admin/roles");
  revalidatePath("/general-manager/users");
  revalidatePath("/admin");
}

export async function deleteRole(formData: FormData) {
  const roleId = text(formData, "roleId");

  if (!roleId) {
    throw new Error("Missing role.");
  }

  const actorId = await getActorId();

  await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({
      where: { id: roleId },
      include: { users: { select: { id: true } } },
    });

    if (role.users.length > 0) {
      throw new Error("This role is assigned to users and cannot be deleted.");
    }

    await tx.role.delete({ where: { id: roleId } });

    await logAction(actorId, "DELETE_ROLE", "Role", role.id, auditSnapshot(role), null, { tx });
  });

  revalidatePath("/admin/roles");
  revalidatePath("/general-manager/users");
  revalidatePath("/admin");
}
