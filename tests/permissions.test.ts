import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  assignablePermissions,
  builtInRoleProfileUpsertData,
  canAssignProfile,
  Permissions,
  type Permission,
} from "../lib/permissions";

// Fix #1 regression: ADMIN may always assign any profile, even when the admin's
// own (possibly scoped) effective permissions are a strict subset of the profile.
test("admin can assign a profile broader than their own scoped permissions", () => {
  const adminScoped: Permission[] = [Permissions.Sales_Read, Permissions.Users_Read];
  const broadProfile: Permission[] = [
    Permissions.Sales_Create,
    Permissions.Sales_Read,
    Permissions.Finance_Read,
    Permissions.Users_Update,
  ];

  assert.equal(canAssignProfile("ADMIN", adminScoped, broadProfile), true);
});

test("an admin cannot delegate the master-tester impersonation capability", () => {
  assert.equal(
    canAssignProfile("ADMIN", [], [Permissions.Testers_Impersonate]),
    false,
  );
});

test("creating a user does not overwrite an existing built-in role profile", () => {
  assert.deepEqual(builtInRoleProfileUpsertData("MANAGER").update, {});
});

test("role-editor permissions never expose the internal Testers resource", () => {
  assert.equal(assignablePermissions.some((permission) => permission.startsWith("Testers_")), false);
});

test("role-editor permissions never expose internal impersonation actions", () => {
  assert.equal(assignablePermissions.some((permission) => permission.endsWith("_Impersonate")), false);
});

test("admin with an empty effective permission set can still assign any profile", () => {
  const broadProfile: Permission[] = [Permissions.Sales_Create, Permissions.Users_Update];
  assert.equal(canAssignProfile("ADMIN", [], broadProfile), true);
});

test("non-admin cannot assign a profile with permissions they lack", () => {
  const managerPerms: Permission[] = [
    Permissions.Sales_Read,
    Permissions.Users_Read,
    Permissions.Users_Update,
    Permissions.Audit_Read,
  ];
  const escalatedProfile: Permission[] = [Permissions.Sales_Read, Permissions.Finance_Update];

  assert.equal(canAssignProfile("MANAGER", managerPerms, escalatedProfile), false);
});

test("non-admin can assign a profile that is a subset of their own permissions", () => {
  const managerPerms: Permission[] = [
    Permissions.Sales_Read,
    Permissions.Users_Read,
    Permissions.Users_Update,
    Permissions.Audit_Read,
  ];
  const limitedProfile: Permission[] = [Permissions.Sales_Read, Permissions.Users_Read];

  assert.equal(canAssignProfile("MANAGER", managerPerms, limitedProfile), true);
});

test("non-admin assigning an identical permission set is allowed", () => {
  const perms: Permission[] = [Permissions.Sales_Read, Permissions.Users_Update];
  assert.equal(canAssignProfile("MANAGER", perms, [...perms]), true);
});

test("role create and update actions enforce the shared no-escalation gate", async () => {
  const source = await readFile(new URL("../app/actions/roles.ts", import.meta.url), "utf8");
  assert.equal(source.match(/requireAssignablePermissions\(actor, permissions\)/g)?.length, 2);
  assert.match(source, /canAssignProfile\(actor\.role, getEffectivePermissions\(actor\), permissions\)/);
});
