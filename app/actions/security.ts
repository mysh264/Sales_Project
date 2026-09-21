"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { createTotpSecret, generateRecoveryCodes, verifyTotp } from "@/lib/totp";
import { getBranchScope, requireBranchAccess } from "@/lib/branch-scope";
import { verifyPasswordStepUp } from "@/lib/security";
import { canManageUserRole } from "@/lib/tester-boundary";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function beginMfaSetup(formData: FormData) {
  const password = text(formData, "password");
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await verifyPasswordStepUp(password, user.passwordHash))) {
    throw new Error("Current password is incorrect.");
  }
  const before = auditSnapshot({ id: user.id, mfaEnabled: user.mfaEnabled, mfaRecoveryCodes: user.mfaRecoveryCodes });
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: createTotpSecret(), mfaEnabled: false, mfaRecoveryCodes: null },
  });
  await logAction(user.id, "MFA_SETUP_BEGIN", "User", user.id, before, auditSnapshot({ id: user.id, mfaEnabled: false, mfaRecoveryCodes: null }));
  revalidatePath("/profile/security");
}

export async function enableMfa(formData: FormData) {
  const code = text(formData, "code");
  const user = await getCurrentUser();
  if (!user?.mfaSecret || !verifyTotp(user.mfaSecret, code)) {
    throw new Error("Invalid authenticator code.");
  }
  const { stored } = await generateRecoveryCodes();
  const before = auditSnapshot({ id: user.id, mfaEnabled: user.mfaEnabled });
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true, mfaRecoveryCodes: stored, sessionVersion: { increment: 1 } },
  });
  await logAction(user.id, "MFA_ENABLE", "User", user.id, before, auditSnapshot({ id: user.id, mfaEnabled: true }));
  revalidatePath("/profile/security");
}

export async function disableMfa(formData: FormData) {
  const password = text(formData, "password");
  const user = await getCurrentUser();
  if (!user || !(await verifyPasswordStepUp(password, user.passwordHash))) {
    throw new Error("Current password is incorrect.");
  }
  const before = auditSnapshot({ id: user.id, mfaEnabled: user.mfaEnabled, mfaRecoveryCodes: user.mfaRecoveryCodes });
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: null, sessionVersion: { increment: 1 } },
  });
  await logAction(user.id, "MFA_DISABLE", "User", user.id, before, auditSnapshot({ id: user.id, mfaEnabled: false }));
  revalidatePath("/profile/security");
}

// Generate recovery codes for an already-enabled MFA account. Returns plaintext codes that are
// shown to the user exactly once; existing codes are invalidated.
export async function regenerateMfaRecoveryCodes(formData: FormData) {
  const password = text(formData, "password");
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (!user.mfaEnabled) {
    throw new Error("Enable two-factor authentication before generating recovery codes.");
  }
  if (!(await verifyPasswordStepUp(password, user.passwordHash))) {
    throw new Error("Current password is incorrect.");
  }
  const { codes, stored } = await generateRecoveryCodes();
  const before = auditSnapshot({ id: user.id, mfaRecoveryCodes: user.mfaRecoveryCodes });
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaRecoveryCodes: stored, sessionVersion: { increment: 1 } },
  });
  await logAction(user.id, "MFA_RECOVERY_REGEN", "User", user.id, before, auditSnapshot({ id: user.id, mfaRecoveryCodes: stored }));
  revalidatePath("/profile/security");
  return codes;
}

export async function resetUserPassword(formData: FormData) {
  const userId = text(formData, "userId");
  const password = text(formData, "newPassword");
  if (!userId || password.length < 12) throw new Error("A password of at least 12 characters is required.");
  const { user: actor } = await requirePermission(Permissions.Users_Update);
  const scope = await getBranchScope();

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!canManageUserRole(actor.role, target.role)) {
      throw new Error("You cannot reset this account.");
    }
    if (target.branchId) requireBranchAccess(scope, target.branchId);
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        sessionVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await logAction(
      actor.id,
      "RESET_USER_PASSWORD",
      "User",
      userId,
      auditSnapshot({ id: target.id, sessionVersion: target.sessionVersion }),
      auditSnapshot({ id: updated.id, sessionVersion: updated.sessionVersion }),
      { tx },
    );
  });
  revalidatePath("/admin/users");
  revalidatePath("/manager/users");
  revalidatePath("/general-manager/users");
}
