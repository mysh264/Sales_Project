"use server";

import bcrypt from "bcryptjs";
import { SignJWT } from "jose/jwt/sign";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getJwtSecret, sessionCookieName, type SessionPayload } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { verifyTotp, consumeRecoveryCode } from "@/lib/totp";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function login(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const mfaCode = text(formData, "mfaCode");
  const recoveryCode = text(formData, "recoveryCode");

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roleProfile: true },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    throw new Error("Invalid login.");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error("Account temporarily locked. Try again later.");
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);

  // When MFA is enabled, accept either a valid TOTP code or a one-time recovery code.
  let mfaValid = !user.mfaEnabled;
  let usedRecoveryCode = false;
  let recoveryCodeCandidate: string | null = null;
  if (user.mfaEnabled) {
    if (mfaCode && user.mfaSecret && verifyTotp(user.mfaSecret, mfaCode)) {
      mfaValid = true;
    } else if (recoveryCode) {
      // Defer consuming the recovery code until the password is verified below, so a wrong
      // password does not burn a valid recovery code (which would lock the user out of MFA recovery).
      recoveryCodeCandidate = recoveryCode;
    }
  }
  // Only after the password is confirmed do we consume a recovery code. This prevents a
  // mistyped password from burning a valid recovery code and locking the user out of MFA recovery.
  if (!mfaValid && recoveryCodeCandidate && passwordOk) {
    const result = await consumeRecoveryCode(user.mfaRecoveryCodes, recoveryCodeCandidate);
    if (result.ok && result.remaining !== null) {
      mfaValid = true;
      usedRecoveryCode = true;
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaRecoveryCodes: result.remaining, sessionVersion: { increment: 1 } },
      });
      const refreshed = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { roleProfile: true },
      });
      user.sessionVersion = refreshed.sessionVersion;
      user.roleProfile = refreshed.roleProfile;
      user.mfaRecoveryCodes = result.remaining;
    }
  }

  const invalidMfa = !mfaValid;
  if (!passwordOk || invalidMfa) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts,
        lockedUntil: failedLoginAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });
    // Record failed login attempts in the audit log so brute-force attempts are visible.
    try {
      const headerStore = await headers();
      const ipAddress = (headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "").slice(0, 64);
      const userAgent = (headerStore.get("user-agent") || "").slice(0, 256);
      await logAction(
        user.id,
        "FAILED_LOGIN",
        "User",
        user.id,
        null,
        { reason: !passwordOk ? "invalid_password" : "invalid_mfa", failedLoginAttempts, locked: failedLoginAttempts >= 5 },
        { ipAddress, userAgent },
      );
    } catch {
      // Audit failure must never block the login rejection.
    }
    throw new Error("Invalid login.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  if (usedRecoveryCode) {
    try {
      const headerStore = await headers();
      await logAction(
        user.id,
        "RECOVERY_CODE_LOGIN",
        "User",
        user.id,
        null,
        { remainingCodes: JSON.parse(user.mfaRecoveryCodes ?? "[]").length },
        {
          ipAddress: (headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "").slice(0, 64),
          userAgent: (headerStore.get("user-agent") || "").slice(0, 256),
        },
      );
    } catch {
      // Audit failure must never block the login.
    }
  }

  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    permissions: getEffectivePermissions(user),
    sessionVersion: user.sessionVersion,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return user.role;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  redirect("/login");
}
