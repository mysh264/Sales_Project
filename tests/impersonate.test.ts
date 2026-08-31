// Master Tester impersonation: pure-function / data-shape tests.
//
// The full end-to-end test (real HTTP request to a running app) is in the
// e2e suite, not here. These tests cover the parts that can be exercised
// without a DB or network: the SessionPayload shape, the role/permission
// wiring, and the impersonation gate from lib/impersonate.ts.
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ROLE_PERMISSIONS, Permissions, hasPermission } from "../lib/permissions";
import { roleHome, allowedForPath } from "../lib/auth";
import { UserRole } from "../generated/prisma/client";
import { canImpersonate } from "../lib/impersonate";

test("the TESTER role is a distinct, narrow identity", () => {
  // The tester is NOT an admin-equivalent. Its only permission is
  // Testers_Impersonate, so it can open /tester and trigger impersonation,
  // but it cannot perform any normal business action.
  const testerPerms = DEFAULT_ROLE_PERMISSIONS[UserRole.TESTER];
  assert.deepEqual(testerPerms, [Permissions.Testers_Impersonate]);
  assert.equal(hasPermission({ role: UserRole.TESTER }, Permissions.Sales_Create), false);
  assert.equal(hasPermission({ role: UserRole.TESTER }, Permissions.Users_Update), false);
});

test("the tester is the only role that holds Testers_Impersonate by default", () => {
  // Admins must not silently gain impersonation rights. The permission is
  // explicitly opt-in via the TESTER role; granting it to ADMIN would let
  // a compromised admin account impersonate anyone with no extra signal.
  for (const role of Object.values(UserRole)) {
    const perms = DEFAULT_ROLE_PERMISSIONS[role];
    const holdsIt = perms.includes(Permissions.Testers_Impersonate);
    if (role === UserRole.TESTER) {
      assert.equal(holdsIt, true, `${role} should hold Testers_Impersonate`);
    } else {
      assert.equal(holdsIt, false, `${role} must NOT hold Testers_Impersonate by default`);
    }
  }
});

test("the tester cannot access any normal business area", () => {
  // The middleware + allowedForPath must consistently deny every
  // non-tester route for the TESTER role. If a future refactor accidentally
  // adds TESTER to an allowlist, this test fails immediately.
  const testerPerms = DEFAULT_ROLE_PERMISSIONS[UserRole.TESTER];
  for (const path of [
    "/admin",
    "/general-manager",
    "/manager",
    "/loader",
    "/salesman",
    "/finance",
    "/print",
    "/admin/audit-logs",
  ]) {
    assert.equal(
      allowedForPath(UserRole.TESTER, path, testerPerms),
      false,
      `TESTER should not access ${path}`,
    );
  }
});

test("the tester's home is /tester and it is the only place TESTER can go", () => {
  assert.equal(roleHome[UserRole.TESTER], "/tester");
  assert.equal(allowedForPath(UserRole.TESTER, "/tester", DEFAULT_ROLE_PERMISSIONS[UserRole.TESTER]), true);
  assert.equal(allowedForPath(UserRole.TESTER, "/tester/audit", DEFAULT_ROLE_PERMISSIONS[UserRole.TESTER]), true);
});

test("canImpersonate: happy path (tester, active test user)", () => {
  assert.equal(
    canImpersonate({ actorHasImpersonate: true, targetIsTestUser: true, targetIsActive: true }),
    true,
  );
});

test("canImpersonate: refuses when target is not a test user (real human)", () => {
  assert.equal(
    canImpersonate({ actorHasImpersonate: true, targetIsTestUser: false, targetIsActive: true }),
    false,
  );
});

test("canImpersonate: refuses when target is inactive", () => {
  assert.equal(
    canImpersonate({ actorHasImpersonate: true, targetIsTestUser: true, targetIsActive: false }),
    false,
  );
});

test("canImpersonate: refuses when actor has no impersonation permission (even if admin)", () => {
  // The gate is on the PERMISSION, not the role. An admin who somehow
  // lacks the Testers_Impersonate permission must not be able to impersonate.
  assert.equal(
    canImpersonate({ actorHasImpersonate: false, targetIsTestUser: true, targetIsActive: true }),
    false,
  );
});
