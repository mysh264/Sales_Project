import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";
import type { SessionPayload } from "@/lib/auth";
import { getJwtSecret, sessionCookieName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// Test hook: when a harness sets globalThis.__TEST_USER__ (a full user row),
// skip the cookie/JWT lookup entirely. Never set in production. The shape
// matches prisma.user.findFirst({ include: { branch, roleProfile } }).
type TestUser = Prisma.UserGetPayload<{ include: { branch: true; roleProfile: true } }>;
declare global {
  var __TEST_USER__: TestUser | null | undefined;
}

export async function getSessionPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getJwtSecret());
    const payload = verified.payload as Partial<SessionPayload>;

    if (!payload.userId || !payload.role) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  // Test hook: when a harness sets globalThis.__TEST_USER__ (a full user row),
  // skip the cookie/JWT lookup entirely. Never set in production.
  if (globalThis.__TEST_USER__) {
    return globalThis.__TEST_USER__;
  }
  const session = await getSessionPayload();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    include: { branch: true, roleProfile: true },
  });
  if (!user || user.sessionVersion !== session.sessionVersion) {
    return null;
  }
  return user;
}

export function hasGlobalSalesAccess(
  user: { role: string; hasGlobalAccess?: boolean | null; allowGlobalSalesView?: boolean | null } | null | undefined,
) {
  if (!user) {
    return false;
  }

  return user.role === "ADMIN" || user.role === "GENERAL_MANAGER" || Boolean(user.hasGlobalAccess ?? user.allowGlobalSalesView);
}
