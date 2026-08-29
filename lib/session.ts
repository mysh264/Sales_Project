import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";
import type { SessionPayload } from "@/lib/auth";
import { getJwtSecret, sessionCookieName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
