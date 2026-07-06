import type { Role, UserRole } from "@prisma/client";

export const Permissions = {
  INVOICE_CREATE: "INVOICE_CREATE",
  INVENTORY_UPDATE: "INVENTORY_UPDATE",
  CUSTOMER_MANAGE: "CUSTOMER_MANAGE",
  PRODUCT_MANAGE: "PRODUCT_MANAGE",
  PRICE_RULE_UPDATE: "PRICE_RULE_UPDATE",
  DEBT_COLLECT: "DEBT_COLLECT",
  FINANCE_VIEW: "FINANCE_VIEW",
  LOGISTICS_EXECUTE: "LOGISTICS_EXECUTE",
  USER_MANAGE: "USER_MANAGE",
  ROLE_MANAGE: "ROLE_MANAGE",
  AUDIT_VIEW: "AUDIT_VIEW",
  AUDIT_DELETE: "AUDIT_DELETE",
  MANAGER_VIEW_ALL_SALES: "MANAGER_VIEW_ALL_SALES",
  SECURITY_BREACH: "SECURITY_BREACH",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const assignablePermissions: Permission[] = [
  Permissions.INVOICE_CREATE,
  Permissions.INVENTORY_UPDATE,
  Permissions.CUSTOMER_MANAGE,
  Permissions.PRODUCT_MANAGE,
  Permissions.PRICE_RULE_UPDATE,
  Permissions.DEBT_COLLECT,
  Permissions.FINANCE_VIEW,
  Permissions.LOGISTICS_EXECUTE,
  Permissions.USER_MANAGE,
  Permissions.ROLE_MANAGE,
  Permissions.AUDIT_VIEW,
  Permissions.AUDIT_DELETE,
  Permissions.MANAGER_VIEW_ALL_SALES,
];

export const permissionLabels: Record<Permission, string> = {
  [Permissions.INVOICE_CREATE]: "Create invoices",
  [Permissions.INVENTORY_UPDATE]: "Update inventory",
  [Permissions.CUSTOMER_MANAGE]: "Manage customers",
  [Permissions.PRODUCT_MANAGE]: "Manage products",
  [Permissions.PRICE_RULE_UPDATE]: "Update price rules",
  [Permissions.DEBT_COLLECT]: "Collect debt",
  [Permissions.FINANCE_VIEW]: "View finance dashboard",
  [Permissions.LOGISTICS_EXECUTE]: "Execute logistics reconciliation",
  [Permissions.USER_MANAGE]: "Manage users",
  [Permissions.ROLE_MANAGE]: "Manage roles",
  [Permissions.AUDIT_VIEW]: "View audit logs",
  [Permissions.AUDIT_DELETE]: "Delete audit logs",
  [Permissions.MANAGER_VIEW_ALL_SALES]: "View all sales",
  [Permissions.SECURITY_BREACH]: "Security breach",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: assignablePermissions.slice(),
  GENERAL_MANAGER: [
    Permissions.INVOICE_CREATE,
    Permissions.INVENTORY_UPDATE,
    Permissions.CUSTOMER_MANAGE,
    Permissions.PRICE_RULE_UPDATE,
    Permissions.DEBT_COLLECT,
    Permissions.FINANCE_VIEW,
    Permissions.USER_MANAGE,
    Permissions.ROLE_MANAGE,
    Permissions.AUDIT_VIEW,
    Permissions.MANAGER_VIEW_ALL_SALES,
  ],
  MANAGER: [
    Permissions.INVOICE_CREATE,
    Permissions.INVENTORY_UPDATE,
    Permissions.CUSTOMER_MANAGE,
    Permissions.DEBT_COLLECT,
    Permissions.FINANCE_VIEW,
    Permissions.AUDIT_VIEW,
    Permissions.MANAGER_VIEW_ALL_SALES,
  ],
  ACCOUNTANT: [Permissions.DEBT_COLLECT, Permissions.PRICE_RULE_UPDATE, Permissions.AUDIT_VIEW, Permissions.FINANCE_VIEW],
  ACCOUNTANT_MANAGER: [
    Permissions.DEBT_COLLECT,
    Permissions.PRICE_RULE_UPDATE,
    Permissions.AUDIT_VIEW,
    Permissions.USER_MANAGE,
    Permissions.FINANCE_VIEW,
  ],
  LOADER: [Permissions.INVENTORY_UPDATE, Permissions.LOGISTICS_EXECUTE],
  SALESMAN: [Permissions.INVOICE_CREATE, Permissions.CUSTOMER_MANAGE],
};

type PermissionSource = {
  role: UserRole;
  roleProfile?: Pick<Role, "permissions"> | null;
};

export function getEffectivePermissions(user: PermissionSource | null | undefined): Permission[] {
  if (!user) {
    return [];
  }

  const permissions = user.roleProfile?.permissions?.length ? user.roleProfile.permissions : DEFAULT_ROLE_PERMISSIONS[user.role];
  return [...new Set(permissions)] as Permission[];
}

export function hasPermission(user: PermissionSource | null | undefined, permission: Permission) {
  return Boolean(user && (user.role === "ADMIN" || getEffectivePermissions(user).includes(permission)));
}
