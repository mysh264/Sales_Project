import type { UserRole } from "@/generated/prisma/client";
import { hasGlobalWriteScope } from "@/lib/global-access";
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
  const canSeeAllBranches = hasGlobalWriteScope(user);

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

export function canAccessBranch(scope: BranchScope | null | undefined, branchId: string | null | undefined) {
  return Boolean(scope && (scope.canSeeAllBranches || (scope.branchId && scope.branchId === branchId)));
}

export function requireBranchAccess(scope: BranchScope | null | undefined, branchId: string | null | undefined) {
  if (!canAccessBranch(scope, branchId)) {
    throw new Error("Unauthorized branch access.");
  }
}
