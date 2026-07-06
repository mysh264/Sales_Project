import type { UserRole } from "@prisma/client";
import { Permissions, type Permission, hasAnyPermission } from "@/lib/permissions";

export const sessionCookieName = "sales_session";

export type SessionPayload = {
  userId: string;
  role: UserRole;
  permissions: Permission[];
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

const routePermissionMap: Array<{ prefix: string; permissions: Permission[] }> = [
  { prefix: "/salesman/new-order", permissions: [Permissions.Sales_Create] },
  { prefix: "/salesman/history", permissions: [Permissions.Sales_Read] },
  { prefix: "/salesman/customer", permissions: [Permissions.Sales_Read] },
  { prefix: "/salesman/receipt", permissions: [Permissions.Sales_Read] },
  { prefix: "/salesman", permissions: [Permissions.Sales_Read] },
  { prefix: "/loader/load", permissions: [Permissions.Logistics_Update] },
  { prefix: "/loader/return", permissions: [Permissions.Logistics_Update] },
  { prefix: "/loader", permissions: [Permissions.Logistics_Read] },
  { prefix: "/logistics/reconciliation", permissions: [Permissions.Logistics_Update] },
  { prefix: "/logistics", permissions: [Permissions.Logistics_Read] },
  { prefix: "/manager/settings", permissions: [Permissions.Products_Update] },
  { prefix: "/manager/all-sales", permissions: [Permissions.Sales_Read] },
  { prefix: "/manager", permissions: [Permissions.Finance_Read] },
  { prefix: "/general-manager/users", permissions: [Permissions.Users_Update] },
  { prefix: "/general-manager/roles", permissions: [Permissions.Roles_Update] },
  { prefix: "/general-manager/branches", permissions: [Permissions.Branches_Update] },
  { prefix: "/general-manager", permissions: [Permissions.Finance_Read] },
  { prefix: "/admin/roles", permissions: [Permissions.Roles_Update] },
  { prefix: "/admin/branches", permissions: [Permissions.Branches_Update] },
  { prefix: "/admin/products", permissions: [Permissions.Products_Update] },
  { prefix: "/admin/audit-logs", permissions: [Permissions.Audit_Read] },
  { prefix: "/admin", permissions: [Permissions.Users_Read] },
  { prefix: "/print", permissions: [Permissions.Sales_Read] },
];

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || "dev-sales-session-secret-change-me";
  return new TextEncoder().encode(secret);
}

export function allowedForPath(role: UserRole, pathname: string, permissions: Permission[] = []) {
  if (pathname === "/") {
    return true;
  }

  if (role === "ADMIN") {
    return true;
  }

  if (pathname.startsWith("/admin-console")) {
    return false;
  }

  const matchedRoute = routePermissionMap.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!matchedRoute) {
    return true;
  }

  return hasAnyPermission({ role, roleProfile: { permissions } }, matchedRoute.permissions);
}
