import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { canReadPaymentAttachment, invoiceAccessWhere } from "../lib/invoice-access";
import { canAccessBranch } from "../lib/branch-scope";
import { allowedForPath, protectedPrefixes, roleHome } from "../lib/auth";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions";
import { UserRole } from "@/generated/prisma/client";
import { businessDate, businessDayRange } from "../lib/business-date";
import { hasGlobalSalesVisibility, hasGlobalWriteScope } from "../lib/global-access";

test("invoice access is restricted to a salesman's own invoices", () => {
  assert.deepEqual(
    invoiceAccessWhere({
      id: "salesman-a",
      role: "SALESMAN",
      branchId: "branch-a",
      hasGlobalAccess: false,
      allowGlobalSalesView: false,
    }),
    { salesmanId: "salesman-a" },
  );
});

test("branch staff are restricted to their assigned branch", () => {
  assert.deepEqual(
    invoiceAccessWhere({
      id: "manager-a",
      role: "MANAGER",
      branchId: "branch-a",
      hasGlobalAccess: false,
      allowGlobalSalesView: false,
    }),
    { branchId: "branch-a" },
  );
});

test("payment attachments require Sales or Finance read permission", () => {
  assert.equal(canReadPaymentAttachment({ role: "LOADER" }), false);
  assert.equal(canReadPaymentAttachment({ role: "SALESMAN" }), true);
  assert.equal(canReadPaymentAttachment({ role: "MANAGER" }), true);
});

test("global and admin access are intentionally unscoped", () => {
  assert.deepEqual(
    invoiceAccessWhere({
      id: "admin",
      role: "ADMIN",
      branchId: null,
      hasGlobalAccess: false,
      allowGlobalSalesView: false,
    }),
    {},
  );
});

test("branch access denies missing and cross-branch assignments", () => {
  const scope = {
    userId: "manager-a",
    role: "MANAGER" as const,
    branchId: "branch-a",
    isAdmin: false,
    canSeeAllBranches: false,
  };
  assert.equal(canAccessBranch(scope, "branch-a"), true);
  assert.equal(canAccessBranch(scope, "branch-b"), false);
  assert.equal(canAccessBranch(scope, null), false);
});

test("global-sales visibility does not grant cross-branch write scope", () => {
  const readOnlyGlobal = {
    role: "MANAGER" as const,
    hasGlobalAccess: false,
    allowGlobalSalesView: true,
  };
  assert.equal(hasGlobalSalesVisibility(readOnlyGlobal), true);
  assert.equal(hasGlobalWriteScope(readOnlyGlobal), false);
});

test("the Global Sales toggle changes only read visibility", async () => {
  const source = await readFile(new URL("../app/actions/users.ts", import.meta.url), "utf8");
  const toggleSource = source.split("export async function toggleGlobalSalesView")[1] ?? "";
  assert.match(toggleSource, /allowGlobalSalesView: nextStatus/);
  assert.doesNotMatch(toggleSource, /hasGlobalAccess: nextStatus/);
});

test("every account type has an authorized home route", () => {
  for (const role of Object.values(UserRole)) {
    assert.equal(
      allowedForPath(role, roleHome[role], DEFAULT_ROLE_PERMISSIONS[role]),
      true,
      `${role} cannot access ${roleHome[role]}`,
    );
  }
});

test("the consolidated manager receives finance and user management without sales creation", () => {
  const permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.MANAGER];
  assert.equal(allowedForPath(UserRole.MANAGER, "/manager", permissions), true);
  assert.equal(allowedForPath(UserRole.MANAGER, "/manager/users", permissions), true);
  assert.equal(allowedForPath(UserRole.MANAGER, "/manager/inventory", permissions), true);
  assert.equal(allowedForPath(UserRole.MANAGER, "/manager/reconciliation", permissions), true);
  assert.equal(allowedForPath(UserRole.MANAGER, "/salesman/new-order", permissions), false);
  assert.equal(allowedForPath(UserRole.MANAGER, "/loader/load/user-id", permissions), false);
});

test("Oman business dates do not depend on the server timezone", () => {
  const lateUtc = new Date("2026-07-23T21:00:00.000Z");
  assert.equal(businessDate(lateUtc).toISOString(), "2026-07-24T00:00:00.000Z");
  const range = businessDayRange(lateUtc);
  assert.equal(range.start.toISOString(), "2026-07-23T20:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-24T20:00:00.000Z");
});

test("unmapped role-prefixed routes are denied by default", () => {
  // Any path that is not covered by any prefix in the route/permission map must be
  // rejected, so a new area added under the middleware matcher (e.g. /billing) cannot
  // become silently open to every logged-in role.
  assert.equal(allowedForPath(UserRole.MANAGER, "/billing/secret", DEFAULT_ROLE_PERMISSIONS[UserRole.MANAGER]), false);
  assert.equal(allowedForPath(UserRole.SALESMAN, "/billing/secret", DEFAULT_ROLE_PERMISSIONS[UserRole.SALESMAN]), false);
  // /profile is self-service and allowed for any authenticated user.
  assert.equal(allowedForPath(UserRole.SALESMAN, "/profile/security", DEFAULT_ROLE_PERMISSIONS[UserRole.SALESMAN]), true);
  assert.equal(allowedForPath(UserRole.LOADER, "/profile", DEFAULT_ROLE_PERMISSIONS[UserRole.LOADER]), true);
});

test("every page.tsx under a protected area is covered by the route/permission map", () => {
  const appDir = path.resolve(process.cwd(), "app");
  const protectedAreaRoots = ["admin", "admin-console", "salesman", "loader", "logistics", "manager", "finance", "general-manager", "print", "profile", "tester"];

  const routePaths: string[] = [];
  for (const entry of readdirSync(appDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "api") continue; // API routes enforce their own auth/permissions.
    if (!protectedAreaRoots.includes(entry.name)) continue;
    collectRoutePaths(path.join(appDir, entry.name), `/${entry.name}`, routePaths);
  }

  const mappedPrefixes = new Set(protectedPrefixes);
  // Areas that are intentionally reachable but denied to non-admins by the
  // middleware (e.g. legacy admin bootstrap URL); they are valid to exist
  // without a permission grant.
  const explicitlyDeniedPrefixes = new Set(["/admin-console"]);
  const publicPrefixes = new Set(["/profile", "/print"]); // self-service / shared print
  const uncovered = routePaths.filter((route) => {
    if (mappedPrefixes.has(route)) return false;
    if (explicitlyDeniedPrefixes.has(route)) return false;
    if ([...mappedPrefixes].some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) return false;
    if ([...explicitlyDeniedPrefixes].some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) return false;
    if ([...publicPrefixes].some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) return false;
    return true;
  });

  assert.deepEqual(uncovered, [], `Unprotected route(s) found: ${uncovered.join(", ")}`);
});

function collectRoutePaths(root: string, routePrefix: string, out: string[]) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  const hasPage = entries.some((entry) => entry.isFile() && (entry.name === "page.tsx" || entry.name === "page.ts"));
  if (hasPage) {
    out.push(routePrefix);
  }
  const dynamicSegments = ["[id]", "[invoiceId]", "[salesmanId]"];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const segment = entry.name.startsWith("[") && entry.name.endsWith("]") ? dynamicSegments[0] : entry.name;
    collectRoutePaths(path.join(root, entry.name), `${routePrefix}/${segment}`, out);
  }
}
