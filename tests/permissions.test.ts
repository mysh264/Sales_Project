import assert from "node:assert/strict";
import test from "node:test";
import { canAssignProfile, Permissions, type Permission } from "../lib/permissions";

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
