"use server";

import { CylinderMovementType, type InventoryBalance } from "@/generated/prisma/client";
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
    await tx.inventoryBalance.upsert({
      where: { branchId_productId: { branchId, productId } },
      create: { branchId, productId, fullCount: 0, emptyCount: 0 },
      update: {},
    });
    const [before] = await tx.$queryRaw<InventoryBalance[]>`
      SELECT *
      FROM "InventoryBalance"
      WHERE "branchId" = ${branchId} AND "productId" = ${productId}
      FOR UPDATE
    `;
    if (!before) throw new Error("Inventory balance could not be loaded.");

    const nextFull = before.fullCount + fullDelta;
    const nextEmpty = before.emptyCount + emptyDelta;
    if (nextFull < 0 || nextEmpty < 0) throw new Error("Adjustment cannot make inventory negative.");

    const after = await tx.inventoryBalance.update({
      where: { id: before.id },
      data: {
        fullCount: { increment: fullDelta },
        emptyCount: { increment: emptyDelta },
      },
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
