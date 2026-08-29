"use server";

import { CylinderMovementType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { auditSnapshot, logAction } from "@/lib/audit";
import { getBranchScope, requireBranchAccess } from "@/lib/branch-scope";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function integer(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!/^-?\d+$/.test(value)) throw new Error("Inventory adjustment must be a whole number.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("Inventory adjustment is too large.");
  return parsed;
}

export async function adjustInventory(formData: FormData) {
  const branchId = text(formData, "branchId");
  const productId = text(formData, "productId");
  const fullDelta = integer(formData, "fullDelta");
  const emptyDelta = integer(formData, "emptyDelta");
  const reason = text(formData, "reason");
  const { user: actor } = await requirePermission(Permissions.Inventory_Update);
  const scope = await getBranchScope();

  if (!branchId || !productId || !reason) throw new Error("Branch, product, and reason are required.");
  if (fullDelta === 0 && emptyDelta === 0) throw new Error("Enter at least one inventory adjustment.");
  requireBranchAccess(scope, branchId);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ lock_acquired: number }>>`
      SELECT 1::int AS lock_acquired
      FROM (SELECT pg_advisory_xact_lock(hashtext('inventory-adjustment'), hashtext(${`${branchId}:${productId}`}))) AS acquired
    `;
    const before = await tx.inventoryBalance.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
    const nextFull = (before?.fullCount ?? 0) + fullDelta;
    const nextEmpty = (before?.emptyCount ?? 0) + emptyDelta;
    if (nextFull < 0 || nextEmpty < 0) throw new Error("Adjustment cannot make inventory negative.");

    const after = await tx.inventoryBalance.upsert({
      where: { branchId_productId: { branchId, productId } },
      update: { fullCount: nextFull, emptyCount: nextEmpty },
      create: { branchId, productId, fullCount: nextFull, emptyCount: nextEmpty },
    });
    await tx.cylinderMovement.create({
      data: { branchId, productId, type: CylinderMovementType.STOCK_ADJUSTMENT, fullDelta, emptyDelta, note: reason },
    });
    await logAction(actor.id, "ADJUST_INVENTORY", "InventoryBalance", after.id, auditSnapshot(before), auditSnapshot(after), { tx });
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/general-manager/inventory");
  revalidatePath("/manager/inventory");
  revalidatePath("/manager");
}
