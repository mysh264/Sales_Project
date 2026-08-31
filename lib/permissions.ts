import type { Role, UserRole } from "@/generated/prisma/client";

export const SYSTEM_RESOURCES = [
  "Sales",
  "Products",
  "Inventory",
  "Logistics",
  "Finance",
  "Users",
  "Roles",
  "Branches",
  "Audit",
  "Testers",
] as const;

export const SYSTEM_ACTIONS = [
  "Create",
  "Read",
  "Update",
  "Delete",
  // Impersonate is a real action verb distinct from CRUD: it lets a holder
  // become another user in the system. Only Testers_Impersonate is granted
  // (to the master tester role); the per-resource Impersonate strings exist
  // for type-system honesty but are never granted to any role.
  "Impersonate",
] as const;

export type SystemResource = (typeof SYSTEM_RESOURCES)[number];
export type SystemAction = (typeof SYSTEM_ACTIONS)[number];
export type Permission = `${SystemResource}_${SystemAction}`;

export function makePermission(resource: SystemResource, action: SystemAction): Permission {
  return `${resource}_${action}` as Permission;
}

const permissionSet = new Set<string>();
for (const resource of SYSTEM_RESOURCES) {
  for (const action of SYSTEM_ACTIONS) {
    permissionSet.add(makePermission(resource, action));
  }
}

const legacyPermissionMap: Record<string, Permission> = {
  INVOICE_CREATE: "Sales_Create",
  INVOICE_READ: "Sales_Read",
  UPDATE_INVOICE: "Sales_Update",
  DELETE_INVOICE: "Sales_Delete",
  CUSTOMER_MANAGE: "Sales_Update",
  MANAGER_VIEW_ALL_SALES: "Sales_Read",
  PRODUCT_MANAGE: "Products_Update",
  PRICE_RULE_UPDATE: "Products_Update",
  INVENTORY_UPDATE: "Inventory_Update",
  LOGISTICS_EXECUTE: "Logistics_Update",
  FINANCE_VIEW: "Finance_Read",
  DEBT_COLLECT: "Finance_Update",
  USER_MANAGE: "Users_Update",
  ROLE_MANAGE: "Roles_Update",
  AUDIT_VIEW: "Audit_Read",
  AUDIT_DELETE: "Audit_Delete",
  SECURITY_BREACH: "Audit_Create",
};

export function normalizePermission(value: string): Permission | null {
  if (permissionSet.has(value)) {
    return value as Permission;
  }

  return legacyPermissionMap[value] ?? null;
}

export function normalizePermissions(values: string[] | null | undefined): Permission[] {
  return [...new Set((values ?? []).map(normalizePermission).filter((value): value is Permission => Boolean(value)))];
}

export const Permissions = Object.freeze(
  Object.fromEntries(
    SYSTEM_RESOURCES.flatMap((resource) =>
      SYSTEM_ACTIONS.map((action) => {
        const permission = makePermission(resource, action);
        return [permission, permission] as const;
      }),
    ),
  ) as Record<Permission, Permission>,
);

export const permissionMatrix = SYSTEM_RESOURCES.map((resource) => ({
  resource,
  permissions: SYSTEM_ACTIONS.map((action) => makePermission(resource, action)),
}));

export const assignablePermissions: Permission[] = permissionMatrix.flatMap((row) => row.permissions);

export const permissionLabels: Record<Permission, string> = Object.fromEntries(
  assignablePermissions.map((permission) => {
    const [resource, action] = permission.split("_") as [SystemResource, SystemAction];
    return [permission, `${action} ${resource.toLowerCase()}`];
  }),
) as Record<Permission, string>;

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // ADMIN gets every assignable permission EXCEPT Testers_Impersonate. The
  // master-tester impersonation capability is a separate trust boundary:
  // even an admin who is fully compromised must not be able to become
  // another user without an explicit, separately-accounted-for TESTER
  // account. Keeping the TESTER role as the only holder of the permission
  // means the audit log always shows a distinct human owning the
  // impersonation actions, instead of blurring them with routine admin work.
  ADMIN: assignablePermissions.filter((p) => p !== Permissions.Testers_Impersonate),
  GENERAL_MANAGER: normalizePermissions([
    "Sales_Create",
    "Sales_Read",
    "Sales_Update",
    "Products_Read",
    "Products_Update",
    "Inventory_Read",
    "Inventory_Update",
    "Logistics_Read",
    "Logistics_Update",
    "Finance_Read",
    "Finance_Update",
    "Users_Read",
    "Users_Update",
    "Roles_Read",
    "Roles_Update",
    "Branches_Read",
    "Branches_Update",
    "Audit_Read",
  ]),
  MANAGER: normalizePermissions([
    "Sales_Read",
    "Sales_Update",
    "Products_Read",
    "Products_Update",
    "Inventory_Read",
    "Inventory_Update",
    "Logistics_Read",
    "Finance_Read",
    "Finance_Update",
    "Users_Read",
    "Users_Update",
    "Audit_Read",
  ]),
  LOADER: normalizePermissions([
    "Products_Read",
    "Inventory_Read",
    "Inventory_Update",
    "Logistics_Read",
    "Logistics_Update",
  ]),
  SALESMAN: normalizePermissions(["Sales_Create", "Sales_Read", "Products_Read"]),
  // The master tester is NOT a normal role: it only holds the
  // Testers_Impersonate permission. Everything else is denied, so the tester
  // cannot accidentally perform real actions — the only thing the tester
  // account can do is open /tester and switch into a canonical test user.
  // The session payload's `impersonatorId` then carries the tester's id
  // forward so the impersonation banner + audit log always know the origin.
  TESTER: normalizePermissions(["Testers_Impersonate"]),
};

type PermissionSource = {
  role: UserRole;
  roleProfile?: Pick<Role, "permissions"> | null;
};

export function getEffectivePermissions(user: PermissionSource | null | undefined): Permission[] {
  if (!user) {
    return [];
  }

  const permissions = user.roleProfile?.permissions?.length
    ? normalizePermissions(user.roleProfile.permissions)
    : DEFAULT_ROLE_PERMISSIONS[user.role];

  return [...new Set(permissions)] as Permission[];
}

export function hasPermission(user: PermissionSource | null | undefined, permission: Permission) {
  return Boolean(user && (user.role === "ADMIN" || getEffectivePermissions(user).includes(permission)));
}

export function hasAnyPermission(user: PermissionSource | null | undefined, permissions: Permission[]) {
  if (!user) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  const granted = new Set(getEffectivePermissions(user));
  return permissions.some((permission) => granted.has(permission));
}

// Whether `actor` may assign a permission `profile` to another user.
// ADMIN may assign any profile; everyone else may only assign profiles whose
// permissions are a subset of their own effective permissions (no privilege
// escalation). This is a pure function so the rule can be unit-tested without a DB.
export function canAssignProfile(
  actorRole: UserRole,
  actorPermissions: Permission[],
  profilePermissions: Permission[],
): boolean {
  if (actorRole === "ADMIN") {
    return true;
  }

  const actorSet = new Set(actorPermissions);
  return profilePermissions.every((permission) => actorSet.has(permission));
}
