"use server";

import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { logAction, auditSnapshot } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

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

export async function createUser(formData: FormData) {
  const fullName = text(formData, "fullName");
  const phone = text(formData, "phone");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const role = parseRole(text(formData, "role"));
  const branchId = text(formData, "branchId") || null;

  if (!fullName || !email || !password) {
    throw new Error("Full name, email, and password are required.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (branchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName,
        phone: phone || null,
        email,
        passwordHash,
        role,
        branchId,
        isActive: true,
        allowGlobalSalesView: false,
      },
    });

    await logAction(
      user.id,
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
        branchId: user.branchId,
        isActive: user.isActive,
        allowGlobalSalesView: user.allowGlobalSalesView,
      }),
      { tx },
    );

  });

  revalidatePath("/general-manager/users");
  revalidatePath("/admin");
}

export async function toggleUserStatus(formData: FormData) {
  const userId = text(formData, "userId");
  const currentStatus = text(formData, "currentStatus") === "true";

  if (!userId) {
    throw new Error("Missing user.");
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { isActive: !currentStatus },
    });

    await logAction(
      userId,
      "UPDATE_PERMISSION",
      "User",
      userId,
      auditSnapshot(user),
      auditSnapshot(updatedUser),
      { tx },
    );
  });

  revalidatePath("/general-manager/users");
  revalidatePath("/admin");
}

export async function updateUserRole(formData: FormData) {
  const userId = text(formData, "userId");
  const role = parseRole(text(formData, "newRole"));
  const branchId = text(formData, "newBranchId") || null;

  if (!userId) {
    throw new Error("Missing user.");
  }

  if (branchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        role,
        branchId,
      },
    });

    await logAction(
      userId,
      "UPDATE_PERMISSION",
      "User",
      userId,
      auditSnapshot(user),
      auditSnapshot(updatedUser),
      { tx },
    );
  });

  revalidatePath("/general-manager/users");
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

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { allowGlobalSalesView: !currentStatus },
    });

    await logAction(
      userId,
      "UPDATE_PERMISSION",
      "User",
      userId,
      auditSnapshot(user),
      auditSnapshot(updatedUser),
      { tx },
    );
  });

  revalidatePath("/general-manager/users");
  revalidatePath("/manager");
  revalidatePath("/admin");
}
