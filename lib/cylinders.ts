import { CylinderMovementType, CylinderStatus } from "@/generated/prisma/client";

type CylinderIdentity = {
  id: string;
  branchId: string;
};

type RawCylinderEvent = {
  type: string;
  status: string;
  note: string;
};

export function buildCylinderEventData(cylinder: CylinderIdentity, input: RawCylinderEvent) {
  if (!(input.type in CylinderMovementType)) {
    throw new Error("Invalid cylinder event type.");
  }
  if (!(input.status in CylinderStatus)) {
    throw new Error("Invalid cylinder status.");
  }

  return {
    cylinderId: cylinder.id,
    branchId: cylinder.branchId,
    type: input.type as CylinderMovementType,
    status: input.status as CylinderStatus,
    note: input.note,
  };
}
