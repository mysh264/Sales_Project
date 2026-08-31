"use server";

import { SignJWT } from "jose/jwt/sign";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getJwtSecret, sessionCookieName, type SessionPayload } from "@/lib/auth";
import { getEffectivePermissions, Permissions, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { canImpersonate } from "@/lib/impersonate";

function envFlag(name: string): boolean {
  return process.env[name] === "true";
}

async function readRequestContext() {
  try {
    const headerStore = await headers();
    return {
      ipAddress: (headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "").slice(0, 64),
      userAgent: (headerStore.get("user-agent") || "").slice(0, 256),
    };
  } catch {
    return { ipAddress: "", userAgent: "" };
  }
}

// Read the current session cookie WITHOUT verifying (we already trust the
// middleware, and we want the impersonatorId even when re-impersonating from
// inside an already-impersonated session). Returns null if the cookie is
// missing or malformed.
async function readRawPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;
  try {
    const { jwtVerify } = await import("jose/jwt/verify");
    const verified = await jwtVerify(token, getJwtSecret());
    const payload = verified.payload as unknown as SessionPayload;
    if (!payload?.userId || !payload?.role) return null;
    return payload;
  } catch {
    return null;
  }
}

async function issueSession(payload: SessionPayload) {
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
}

export async function isMasterTesterEnabled(): Promise<boolean> {
  return envFlag("MASTERTESTER_ENABLED");
}

export async function startImpersonation(formData: FormData) {
  if (!envFlag("MASTERTESTER_ENABLED")) {
    throw new Error("Master tester feature is disabled.");
  }

  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  if (!targetUserId) {
    throw new Error("Missing targetUserId.");
  }

  const current = await readRawPayload();
  if (!current) {
    redirect("/login");
  }

  // Resolve the tester's effective permissions (the tester might have lost
  // the Testers_Impersonate permission since the cookie was issued, in which
  // case we refuse — re-login).
  const tester = await prisma.user.findUnique({
    where: { id: current.userId },
    include: { roleProfile: true },
  });
  if (!tester || !hasPermission(tester, Permissions.Testers_Impersonate)) {
    throw new Error("Not authorized to impersonate.");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { roleProfile: true },
  });
  if (!target) {
    throw new Error("Target user not found.");
  }
  if (!target.isActive) {
    throw new Error("Target user is inactive.");
  }
  // The hard gate is shared with tests/impersonate.test.ts: the same
  // canImpersonate() function decides here as decides in the unit tests,
  // so they cannot drift.
  if (!canImpersonate({
    actorHasImpersonate: hasPermission(tester, Permissions.Testers_Impersonate),
    targetIsTestUser: target.isTestUser,
    targetIsActive: target.isActive,
  })) {
    throw new Error("Not authorized to impersonate this user.");
  }

  const targetPayload: SessionPayload = {
    userId: target.id,
    role: target.role,
    permissions: getEffectivePermissions(target),
    sessionVersion: target.sessionVersion,
    // Carry the tester (or whoever started the chain) forward so the banner
    // and audit log know the origin even if the tester nests impersonations
    // later. If the caller is already inside an impersonation, keep the
    // original tester as the canonical impersonator.
    impersonatorId: current.impersonatorId ?? tester.id,
  };

  await issueSession(targetPayload);

  const ctx = await readRequestContext();
  await logAction(
    tester.id, // audit AS the tester, not the target
    "IMPERSONATE_START",
    "User",
    target.id,
    null,
    {
      targetEmail: target.email,
      targetRole: target.role,
      targetBranchId: target.branchId,
      impersonatedFromSessionUserId: current.userId,
      nested: current.impersonatorId ? true : false,
    },
    ctx,
  );

  revalidatePath("/", "layout");
  // Send the tester straight to the target's role home so they land in the UI
  // they came here to test.
  const homeByRole: Record<string, string> = {
    ADMIN: "/admin",
    GENERAL_MANAGER: "/general-manager",
    MANAGER: "/manager",
    LOADER: "/loader",
    SALESMAN: "/salesman",
  };
  redirect(homeByRole[target.role] ?? "/");
}

export async function stopImpersonation() {
  if (!envFlag("MASTERTESTER_ENABLED")) {
    throw new Error("Master tester feature is disabled.");
  }

  const current = await readRawPayload();
  if (!current) {
    redirect("/login");
  }
  if (!current.impersonatorId) {
    // Not currently impersonating; nothing to do.
    redirect("/tester");
  }

  const originalTester = await prisma.user.findUnique({
    where: { id: current.impersonatorId },
    include: { roleProfile: true },
  });
  if (!originalTester || !hasPermission(originalTester, Permissions.Testers_Impersonate)) {
    // The original tester was deleted or stripped of the permission.
    // Invalidate the session by deleting the cookie and sending to login.
    const cookieStore = await cookies();
    cookieStore.delete(sessionCookieName);
    redirect("/login");
  }

  const testerPayload: SessionPayload = {
    userId: originalTester.id,
    role: originalTester.role,
    permissions: getEffectivePermissions(originalTester),
    sessionVersion: originalTester.sessionVersion,
    // no impersonatorId — the tester is back to their own identity
  };
  await issueSession(testerPayload);

  const ctx = await readRequestContext();
  await logAction(
    originalTester.id,
    "IMPERSONATE_STOP",
    "User",
    current.userId,
    null,
    {
      stoppedImpersonatingUserId: current.userId,
      stoppedImpersonatingEmail: null, // best-effort, see below
    },
    ctx,
  );

  revalidatePath("/", "layout");
  redirect("/tester");
}

// Helper used by the /tester launchpad to render the list of impersonation
// targets. Returns only users that are isTestUser=true, so the UI doesn't
// have to know about the gate. Excludes the tester itself (impersonating
// yourself is meaningless).
export async function listImpersonationTargets() {
  if (!envFlag("MASTERTESTER_ENABLED")) {
    return [];
  }
  const users = await prisma.user.findMany({
    where: { isTestUser: true },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      branchId: true,
      branch: { select: { code: true, name: true } },
    },
  });
  // Exclude the master tester itself (any user whose only permission is
  // Testers_Impersonate). We do this by exclusion: if the user has the
  // TESTER role, skip it. That keeps the SQL simple and the gate testable.
  return users
    .filter((u) => u.role !== "TESTER")
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      fullName: u.fullName,
      role: u.role,
      branchCode: u.branch?.code ?? null,
      branchName: u.branch?.name ?? null,
    }));
}

// Helper used by the audit page to show the recent impersonation events
// for the current tester. Read-only.
export async function listMyImpersonationEvents(limit = 100) {
  if (!envFlag("MASTERTESTER_ENABLED")) {
    return [];
  }
  const current = await readRawPayload();
  if (!current) {
    return [];
  }
  // The "real" tester is the impersonator if set, else the current user.
  const testerId = current.impersonatorId ?? current.userId;
  const events = await prisma.auditLog.findMany({
    where: {
      userId: testerId,
      action: { in: ["IMPERSONATE_START", "IMPERSONATE_STOP"] },
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });
  return events.map((e) => ({
    id: e.id,
    action: e.action,
    targetId: e.targetId,
    ipAddress: e.ipAddress,
    timestamp: e.timestamp,
    // The newValue column is JSON; the shape is what we wrote in
    // startImpersonation / stopImpersonation above.
    newValue: e.newValue,
  }));
}
