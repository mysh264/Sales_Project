type GlobalAccessSubject = {
  role: string;
  hasGlobalAccess?: boolean | null;
  allowGlobalSalesView?: boolean | null;
} | null | undefined;

export function hasGlobalWriteScope(user: GlobalAccessSubject): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "GENERAL_MANAGER" || Boolean(user.hasGlobalAccess);
}

export function hasGlobalSalesVisibility(user: GlobalAccessSubject): boolean {
  return hasGlobalWriteScope(user) || Boolean(user?.allowGlobalSalesView);
}
