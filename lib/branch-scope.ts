import type { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";

export type BranchScope = {
  userId: string;
  role: UserRole;
  branchId: string | null;
  isAdmin: boolean;
  canSeeAllBranches: boolean;
};

export async function getBranchScope() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "ADMIN";
  const canSeeAllBranches = isAdmin || Boolean(user.hasGlobalAccess ?? user.allowGlobalSalesView);

  return {
    userId: user.id,
    role: user.role,
    branchId: user.branchId ?? null,
    isAdmin,
    canSeeAllBranches,
  } satisfies BranchScope;
}

export function branchWhere(scope: BranchScope | null | undefined) {
  if (!scope || scope.canSeeAllBranches) {
    return undefined;
  }

  if (!scope.branchId) {
    return { branchId: "__no_branch__" };
  }

  return { branchId: scope.branchId };
}
