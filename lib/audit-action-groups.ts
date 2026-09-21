const AUDIT_ACTION_GROUPS: Record<string, readonly string[]> = {
  invoice_changes: ["CREATE_INVOICE", "UPDATE_INVOICE"],
  invoice_deletions: ["DELETE_INVOICE"],
  inventory_changes: ["ADJUST_INVENTORY"],
  reconciliation: ["CREATE_RECONCILIATION", "UPDATE_RECONCILIATION", "APPROVE_RECONCILIATION_DISCREPANCY"],
  user_changes: ["CREATE_USER", "UPDATE_PERMISSION", "UPDATE_USER_STATUS"],
  password_resets: ["RESET_USER_PASSWORD"],
  role_changes: ["CREATE_ROLE", "UPDATE_ROLE", "DELETE_ROLE"],
  branch_changes: ["CREATE_BRANCH", "UPDATE_BRANCH"],
  product_changes: ["CREATE_PRODUCT", "UPDATE_PRODUCT", "DELETE_PRODUCT", "RESTORE_PRODUCT"],
  debt_collection: ["COLLECT_DEBT"],
  pricing: ["UPDATE_PRICE_RULE"],
  security_breaches: ["SECURITY_BREACH"],
};

export function auditActionsForGroup(group: string | null | undefined): string[] {
  return group ? [...(AUDIT_ACTION_GROUPS[group] ?? [])] : [];
}
