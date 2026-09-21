import { ReconciliationStatus } from "@/generated/prisma/client";
import { hasGlobalWriteScope } from "@/lib/global-access";

type ReconciliationActor = {
  role: string;
  branchId: string | null;
  hasGlobalAccess?: boolean | null;
};

export function canHandleReconciliationBranch(actor: ReconciliationActor, branchId: string | null): boolean {
  return hasGlobalWriteScope(actor) || Boolean(actor.branchId && branchId && actor.branchId === branchId);
}

export function calculateRouteReturn(input: {
  morningFull: number;
  eveningReturnedFull: number;
  eveningReturnedEmpty: number;
}) {
  if (input.eveningReturnedFull > input.morningFull) {
    throw new Error("Returned full cylinders cannot exceed morning load.");
  }

  const soldFull = input.morningFull - input.eveningReturnedFull;
  return {
    soldFull,
    missingEmpty: Math.max(0, soldFull - input.eveningReturnedEmpty),
  };
}

export function canReplaceMorningLoad(input: { status: ReconciliationStatus; invoiceCount: number }): boolean {
  return input.status === ReconciliationStatus.MORNING_RECORDED && input.invoiceCount === 0;
}

export function parseCylinderQuantity(value: string | undefined): number {
  const normalized = value?.trim() || "0";
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Cylinder quantities must be a whole number of zero or more.");
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("Cylinder quantity is too large.");
  }
  return parsed;
}
