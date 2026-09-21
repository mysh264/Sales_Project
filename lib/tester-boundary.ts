import type { UserRole } from "@/generated/prisma/client";

export function canUseTestAccount(input: {
  featureEnabled: boolean;
  isTestUser: boolean;
  role: UserRole;
}): boolean {
  if (!input.isTestUser && input.role !== "TESTER") return true;
  return input.featureEnabled;
}

export function canManageUserRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === "TESTER") return false;
  if (actorRole === "ADMIN") return true;
  if (actorRole === "GENERAL_MANAGER") return targetRole !== "ADMIN";
  return actorRole === "MANAGER" && (targetRole === "LOADER" || targetRole === "SALESMAN");
}
