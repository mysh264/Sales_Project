import type { UserRole } from "@/generated/prisma/client";
import { Permissions, type Permission, hasAnyPermission } from "@/lib/permissions";

export const sessionCookieName = "sales_session";

export type SessionPayload = {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  sessionVersion: number;
  // Set when this session was issued by the master tester via impersonation.
  // The id is the tester account that started the impersonation. The banner
  // uses it to show "Original session: tester@…", and the audit log uses it
  // to attribute every action taken while impersonating back to the tester.
  impersonatorId?: string;
};

export const roleHome: Record<UserRole, string> = {
  ADMIN: "/admin",
  GENERAL_MANAGER: "/general-manager",
  MANAGER: "/manager",
  LOADER: "/loader",
  SALESMAN: "/salesman",
  TESTER: "/tester",
};

export const routePermissionMap: Array<{ prefix: string; permissions: Permission[] }> = [
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
  { prefix: "/manager/users", permissions: [Permissions.Users_Update] },
  { prefix: "/manager/inventory", permissions: [Permissions.Inventory_Update] },
  { prefix: "/manager/reconciliation", permissions: [Permissions.Finance_Read] },
  { prefix: "/manager/all-sales", permissions: [Permissions.Sales_Read] },
  { prefix: "/manager", permissions: [Permissions.Finance_Read] },
  { prefix: "/finance/reconciliation-overview", permissions: [Permissions.Finance_Read] },
  { prefix: "/finance", permissions: [Permissions.Finance_Read] },
  { prefix: "/general-manager/users", permissions: [Permissions.Users_Update] },
  { prefix: "/general-manager/finance", permissions: [Permissions.Finance_Read] },
  { prefix: "/general-manager/reconciliation", permissions: [Permissions.Finance_Read] },
  { prefix: "/general-manager/inventory", permissions: [Permissions.Inventory_Update] },
  { prefix: "/general-manager/audit-logs", permissions: [Permissions.Audit_Read] },
  { prefix: "/general-manager/products", permissions: [Permissions.Products_Update] },
  { prefix: "/general-manager/roles", permissions: [Permissions.Roles_Update] },
  { prefix: "/general-manager/branches", permissions: [Permissions.Branches_Update] },
  { prefix: "/general-manager", permissions: [Permissions.Finance_Read] },
  { prefix: "/admin/roles", permissions: [Permissions.Roles_Update] },
  { prefix: "/admin/branches", permissions: [Permissions.Branches_Update] },
  { prefix: "/admin/products", permissions: [Permissions.Products_Update] },
  { prefix: "/admin/inventory", permissions: [Permissions.Inventory_Update] },
  { prefix: "/admin/audit-logs", permissions: [Permissions.Audit_Read] },
  { prefix: "/admin", permissions: [Permissions.Users_Read] },
  { prefix: "/print", permissions: [Permissions.Sales_Read] },
  // Master tester launchpad. Only holders of Testers_Impersonate can enter
  // (i.e. the seeded master-tester account). Impersonation targets are
  // listed inside the page; the impersonation server action reissues the
  // session cookie as the target user.
  { prefix: "/tester", permissions: [Permissions.Testers_Impersonate] },
];

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET (or AUTH_SECRET) must be configured with at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function allowedForPath(role: UserRole, pathname: string, permissions: Permission[] = []) {
  if (pathname === "/") {
    return true;
  }

  // API routes perform their own authentication/authorization internally
  // (e.g. /api/attachments checks getCurrentUser() + invoiceAccessWhere). The
  // middleware only guarantees a valid session reaches them; they self-guard.
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return true;
  }

  if (pathname.startsWith("/admin-console")) {
    return role === "ADMIN";
  }

  // /profile is self-service (e.g. MFA enrolment) available to any authenticated user,
  // independent of role permissions.
  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    return true;
  }

  const matchedRoute = routePermissionMap.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // Default-deny: any authenticated request to a role-prefixed area that is not
  // explicitly mapped has no permission grant and must be rejected, so a new
  // route added under /admin, /manager, /finance, etc. cannot become silently
  // open to every logged-in role.
  if (!matchedRoute) {
    return false;
  }

  return hasAnyPermission({ role, roleProfile: { permissions } }, matchedRoute.permissions);
}

// Prefixes that are explicitly mapped to a permission. Used by tests to assert the
// route/permission map stays in sync with the protected route surface.
export const protectedPrefixes = routePermissionMap.map(({ prefix }) => prefix);
