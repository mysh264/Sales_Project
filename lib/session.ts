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

  return prisma.user.findUnique({
    where: { id: session.userId },
    include: { branch: true },
  });
}

export function hasGlobalSalesAccess(user: { role: string; allowGlobalSalesView?: boolean | null } | null | undefined) {
  if (!user) {
    return false;
  }

  return user.role === "ADMIN" || Boolean(user.allowGlobalSalesView);
}
