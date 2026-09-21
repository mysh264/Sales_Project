import assert from "node:assert/strict";
import test from "node:test";
import { canManageUserRole, canUseTestAccount } from "../lib/tester-boundary";

test("test accounts cannot log in after the master-tester feature is disabled", () => {
  assert.equal(canUseTestAccount({ featureEnabled: false, isTestUser: true, role: "MANAGER" }), false);
  assert.equal(canUseTestAccount({ featureEnabled: false, isTestUser: false, role: "TESTER" }), false);
});

test("ordinary accounts are unaffected by the master-tester login gate", () => {
  assert.equal(canUseTestAccount({ featureEnabled: false, isTestUser: false, role: "MANAGER" }), true);
});

test("routine user management cannot create or assign the TESTER role", () => {
  assert.equal(canManageUserRole("ADMIN", "TESTER"), false);
  assert.equal(canManageUserRole("ADMIN", "ADMIN"), true);
  assert.equal(canManageUserRole("GENERAL_MANAGER", "MANAGER"), true);
});
