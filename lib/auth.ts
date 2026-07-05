import type { UserRole } from "@prisma/client";

export const sessionCookieName = "sales_session";

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

export const roleHome: Record<UserRole, string> = {
  ADMIN: "/admin",
  GENERAL_MANAGER: "/general-manager",
  MANAGER: "/manager",
  ACCOUNTANT_MANAGER: "/manager",
  ACCOUNTANT: "/manager",
  LOADER: "/loader",
  SALESMAN: "/salesman",
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || "dev-sales-session-secret-change-me";
  return new TextEncoder().encode(secret);
}

export function allowedForPath(role: UserRole, pathname: string) {
  if (pathname === "/") {
    return true;
  }

  if (role === "ADMIN") {
    return true;
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/admin-console")) {
    return false;
  }

  if (pathname.startsWith("/salesman")) {
    return role === "SALESMAN";
  }

  if (pathname.startsWith("/loader")) {
    return role === "LOADER";
  }

  if (pathname.startsWith("/manager")) {
    return role === "MANAGER" || role === "ACCOUNTANT_MANAGER" || role === "ACCOUNTANT";
  }

  if (pathname.startsWith("/general-manager")) {
    return role === "GENERAL_MANAGER";
  }

  if (pathname.startsWith("/print")) {
    return role !== "GENERAL_MANAGER";
  }

  return true;
}
