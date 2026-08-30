"use server";

import { CylinderMovementType, ReconciliationStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { businessDate, businessDayRange } from "@/lib/business-date";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function dayOnly(date = new Date()) {
  return businessDate(date);
}

function parseRows(formData: FormData, morningKey: string, returnedFullKey?: string, returnedEmptyKey?: string) {
  const productIds = formData.getAll("productId").filter((value): value is string => typeof value === "string");
  const morningValues = formData.getAll(morningKey).filter((value): value is string => typeof value === "string");
  const fullValues = returnedFullKey
    ? formData.getAll(returnedFullKey).filter((value): value is string => typeof value === "string")
    : [];
  const emptyValues = returnedEmptyKey
    ? formData.getAll(returnedEmptyKey).filter((value): value is string => typeof value === "string")
    : [];

  return productIds
    .map((productId, index) => ({
      productId,
      morningFull: Number.parseInt(morningValues[index] || "0", 10) || 0,
      eveningReturnedFull: Number.parseInt(fullValues[index] || "0", 10) || 0,
      eveningReturnedEmpty: Number.parseInt(emptyValues[index] || "0", 10) || 0,
    }))
    .filter((item) => item.productId);
}

function normalizeProductRows<T extends { productId: string; morningFull: number; eveningReturnedFull: number; eveningReturnedEmpty: number }>(
  rows: T[],
) {
  const ordered = new Map<string, T>();

  for (const row of rows) {
    const current = ordered.get(row.productId);
    if (!current) {
      ordered.set(row.productId, { ...row });
      continue;
    }

    ordered.set(row.productId, {
      ...current,
      morningFull: current.morningFull + row.morningFull,
      eveningReturnedFull: current.eveningReturnedFull + row.eveningReturnedFull,
      eveningReturnedEmpty: current.eveningReturnedEmpty + row.eveningReturnedEmpty,
    });
  }

  return [...ordered.values()];
}

function validationRedirect(basePath: string, salesmanId: string, message: string) {
  const params = new URLSearchParams({ error: message });
  redirect(`${basePath}/${encodeURIComponent(salesmanId)}?${params.toString()}`);
}

function canHandleRoute(
  currentUser: {
    role: string;
    branchId: string | null;
    hasGlobalAccess?: boolean | null;
  },
  salesman: {
    branchId: string | null;
  },
) {
  if (currentUser.role === "ADMIN" || currentUser.hasGlobalAccess) {
    return true;
  }

  if (!currentUser.branchId || !salesman.branchId) {
    return false;
  }

  return currentUser.branchId === salesman.branchId;
}

async function resolveSalesmanContext(salesmanId: string) {
  const salesman = await prisma.user.findUnique({
    where: { id: salesmanId },
    include: { branch: true },
  });

  if (!salesman || salesman.role !== "SALESMAN" || !salesman.isActive) {
    throw new Error("Select an active salesman.");
  }

  return salesman;
}

async function loadProducts(productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];
  const products = await prisma.product.findMany({
    where: {
      id: { in: uniqueIds },
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (products.length !== uniqueIds.length) {
    throw new Error("One or more selected products are not available.");
  }

  return products;
}

export async function processMorningLoad(formData: FormData) {
  const salesmanId = text(formData, "salesmanId");
  const productIds = formData.getAll("productId").filter((value): value is string => typeof value === "string");

  if (!salesmanId) {
    redirect(`/loader?error=${encodeURIComponent("Missing salesman.")}`);
  }

  const { user: currentUser } = await requirePermission(Permissions.Logistics_Update);
  const salesman = await resolveSalesmanContext(salesmanId);

  if (!canHandleRoute(currentUser, salesman)) {
    validationRedirect("/loader/load", salesmanId, "You can only hand off routes within your own branch.");
  }

  const branchId = salesman.branchId ?? currentUser.branchId;
  if (!branchId) {
    throw new Error("Salesman must belong to a branch.");
  }

  const rows = normalizeProductRows(
    parseRows(formData, "morningFull")
      .filter((item) => item.morningFull > 0)
      .map((item) => ({ ...item, eveningReturnedFull: 0, eveningReturnedEmpty: 0 })),
  );

  if (rows.length === 0) {
    validationRedirect("/loader/load", salesmanId, "Enter at least one loaded cylinder quantity.");
  }

  await loadProducts(productIds);

  const reconciliationDate = dayOnly();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyReconciliation.findUnique({
      where: {
        salesmanId_reconciliationDate: {
          salesmanId,
          reconciliationDate,
        },
      },
      include: {
        items: true,
      },
    });

    if (existing?.status === ReconciliationStatus.EVENING_RECONCILED) {
      throw new Error("This salesman already has a completed route for today.");
    }

    if (existing) {
      for (const item of existing.items) {
        // Best-effort undo of the prior load's inventory deduction. If the balance row
        // is missing (e.g. product was reactivated after the branch was created and no
        // row was backfilled) there is nothing to credit back, so skip silently.
        await tx.inventoryBalance.upsert({
          where: { branchId_productId: { branchId, productId: item.productId } },
          create: { branchId, productId: item.productId, fullCount: item.morningFull, emptyCount: 0 },
          update: { fullCount: { increment: item.morningFull } },
        });
      }
      await tx.cylinderMovement.deleteMany({ where: { reconciliationId: existing.id } });
    }

    const reconciliation = existing
      ? await tx.dailyReconciliation.update({
          where: { id: existing.id },
          data: {
            branchId,
            loaderId: currentUser.id,
            status: ReconciliationStatus.MORNING_RECORDED,
            morningLoggedAt: new Date(),
            eveningReconciledAt: null,
            notes: null,
          },
        })
      : await tx.dailyReconciliation.create({
          data: {
            branchId,
            salesmanId,
            loaderId: currentUser.id,
            reconciliationDate,
            morningLoggedAt: new Date(),
            status: ReconciliationStatus.MORNING_RECORDED,
          },
        });

    await tx.dailyReconciliationItem.deleteMany({
      where: { reconciliationId: reconciliation.id },
    });

    await tx.dailyReconciliationItem.createMany({
      data: rows.map((row) => ({
        reconciliationId: reconciliation.id,
        productId: row.productId,
        morningFull: row.morningFull,
        eveningReturnedFull: 0,
        eveningReturnedEmpty: 0,
        soldFull: 0,
      })),
    });

    // Ensure every product has an InventoryBalance row at this branch before the conditional
    // deduction. A product that was inactive when the branch was created has no balance row
    // (saveBranch/createMany only seeds active products), and was reactivated afterwards —
    // auto-creating the row here lets the gte check below distinguish "missing row" from
    // "genuinely insufficient stock" and gives a correct error in both cases.
    for (const row of rows) {
      await tx.inventoryBalance.upsert({
        where: { branchId_productId: { branchId, productId: row.productId } },
        create: { branchId, productId: row.productId, fullCount: 0, emptyCount: 0 },
        update: {},
      });
    }

    for (const row of rows) {
      const deducted = await tx.inventoryBalance.updateMany({
        where: { branchId, productId: row.productId, fullCount: { gte: row.morningFull } },
        data: { fullCount: { decrement: row.morningFull } },
      });
      if (deducted.count !== 1) {
        throw new Error("Insufficient branch inventory for this morning load.");
      }
      await tx.cylinderMovement.create({
        data: {
          branchId,
          productId: row.productId,
          reconciliationId: reconciliation.id,
          type: CylinderMovementType.DAILY_LOAD_FULL,
          fullDelta: -row.morningFull,
          note: `Morning load for ${salesman.fullName}`,
        },
      });
    }

    const reconciliationAfter = await tx.dailyReconciliation.findUniqueOrThrow({
      where: { id: reconciliation.id },
      include: {
        items: {
          include: { product: true },
          orderBy: { productId: "asc" },
        },
        branch: true,
        salesman: true,
        loader: true,
      },
    });

    await logAction(
      currentUser.id,
      "CREATE_RECONCILIATION",
      "DailyReconciliation",
      reconciliation.id,
      auditSnapshot(existing),
      auditSnapshot(reconciliationAfter),
      { tx },
    );
  });

  revalidatePath("/loader");
  revalidatePath("/finance/reconciliation-overview");
  redirect(`/loader/load/${encodeURIComponent(salesmanId)}`);
}

export async function processEveningReturn(formData: FormData) {
  const salesmanId = text(formData, "salesmanId");
  const reconciliationId = text(formData, "reconciliationId");

  if (!salesmanId) {
    redirect(`/loader?error=${encodeURIComponent("Missing salesman.")}`);
  }

  const { user: currentUser } = await requirePermission(Permissions.Logistics_Update);
  const salesman = await resolveSalesmanContext(salesmanId);

  if (!canHandleRoute(currentUser, salesman)) {
    validationRedirect("/loader/return", salesmanId, "You can only close routes within your own branch.");
  }

  const reconciliationDate = dayOnly();
  const normalizedList = normalizeProductRows(
    parseRows(formData, "morningFull", "eveningReturnedFull", "eveningReturnedEmpty").map((row) => ({
      ...row,
    })),
  );

  if (normalizedList.length === 0) {
    validationRedirect("/loader/return", salesmanId, "Enter at least one evening reconciliation row.");
  }

  await prisma.$transaction(async (tx) => {
    const reconciliation = reconciliationId
      ? await tx.dailyReconciliation.findUniqueOrThrow({
          where: { id: reconciliationId },
          include: {
            items: true,
            branch: true,
            salesman: true,
            loader: true,
          },
        })
      : await tx.dailyReconciliation.findUniqueOrThrow({
          where: {
            salesmanId_reconciliationDate: {
              salesmanId,
              reconciliationDate,
            },
          },
          include: {
            items: true,
            branch: true,
            salesman: true,
            loader: true,
          },
        });

    if (reconciliation.salesmanId !== salesmanId || !canHandleRoute(currentUser, reconciliation.salesman)) {
      throw new Error("Unauthorized reconciliation access.");
    }

    if (reconciliation.status === ReconciliationStatus.EVENING_RECONCILED) {
      throw new Error("This route has already been completed.");
    }

    const itemMap = new Map<string, (typeof reconciliation.items)[number]>(
      reconciliation.items.map((item) => [item.productId, item]),
    );
    const { start: invoiceDayStart, end: dayEnd } = businessDayRange(reconciliation.reconciliationDate);
    const invoiceTotals = await tx.invoiceItem.groupBy({
      by: ["productId"],
      where: {
        invoice: {
          salesmanId,
          status: "ISSUED",
          createdAt: { gte: invoiceDayStart, lt: dayEnd },
        },
      },
      _sum: { fullCylindersDelivered: true, emptyCylindersReturned: true },
    });
    const invoiceMap = new Map(invoiceTotals.map((row) => [row.productId, row._sum]));

    // Every morning-load product must be represented in the evening return, otherwise its
    // loaded-vs-invoiced variance is never checked and its cylinders are never returned to
    // inventory. Silently omitting a product would mask a discrepancy and lose stock.
    const submittedProductIds = new Set(normalizedList.map((row) => row.productId));
    for (const item of reconciliation.items) {
      if (!submittedProductIds.has(item.productId)) {
        throw new Error("Evening reconciliation must include every morning-load product.");
      }
    }

    for (const row of normalizedList) {
      if (
        !Number.isSafeInteger(row.eveningReturnedFull) ||
        !Number.isSafeInteger(row.eveningReturnedEmpty) ||
        row.eveningReturnedFull < 0 ||
        row.eveningReturnedEmpty < 0
      ) {
        throw new Error("Returned cylinder quantities must be whole numbers of zero or more.");
      }
      const item = itemMap.get(row.productId);

      if (!item) {
        throw new Error("Evening reconciliation must include the morning load products.");
      }

      const soldFull = item.morningFull - row.eveningReturnedFull;
      const missingEmpty = item.morningFull - row.eveningReturnedFull - row.eveningReturnedEmpty;
      if (soldFull < 0) {
        throw new Error("Returned full cylinders cannot exceed morning load.");
      }

      if (missingEmpty < 0) {
        throw new Error("Returned cylinders cannot exceed morning load.");
      }
    }
    const hasDiscrepancy = normalizedList.some((row) => {
      const currentItem = itemMap.get(row.productId)!;
      return (
        currentItem.morningFull - row.eveningReturnedFull !==
          (invoiceMap.get(row.productId)?.fullCylindersDelivered ?? 0) ||
        row.eveningReturnedEmpty !== (invoiceMap.get(row.productId)?.emptyCylindersReturned ?? 0)
      );
    });

    const reconciliationBefore = auditSnapshot(reconciliation);

    await tx.dailyReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: hasDiscrepancy ? ReconciliationStatus.DISCREPANCY_PENDING : ReconciliationStatus.EVENING_RECONCILED,
        eveningReconciledAt: hasDiscrepancy ? null : new Date(),
        discrepancyApprovedById: null,
        discrepancyApprovedAt: null,
        discrepancyReason: null,
      },
    });

    for (const row of normalizedList) {
      const currentItem = itemMap.get(row.productId)!;
      const invoiceSoldFull = invoiceMap.get(row.productId)?.fullCylindersDelivered ?? 0;
      const invoiceEmptyReturned = invoiceMap.get(row.productId)?.emptyCylindersReturned ?? 0;
      const missingEmpty = currentItem.morningFull - row.eveningReturnedFull - row.eveningReturnedEmpty;
      const updatedItem = await tx.dailyReconciliationItem.update({
        where: {
          reconciliationId_productId: {
            reconciliationId: reconciliation.id,
            productId: row.productId,
          },
        },
        data: {
          eveningReturnedFull: row.eveningReturnedFull,
          eveningReturnedEmpty: row.eveningReturnedEmpty,
          missingEmpty,
          soldFull: currentItem.morningFull - row.eveningReturnedFull,
          invoiceSoldFull,
          invoiceEmptyReturned,
          varianceFull: currentItem.morningFull - row.eveningReturnedFull - invoiceSoldFull,
          varianceEmpty: row.eveningReturnedEmpty - invoiceEmptyReturned,
        },
      });
      if (!hasDiscrepancy) {
        await tx.inventoryBalance.update({
          where: { branchId_productId: { branchId: reconciliation.branchId, productId: row.productId } },
          data: {
            fullCount: { increment: row.eveningReturnedFull },
            emptyCount: { increment: row.eveningReturnedEmpty },
          },
        });
      }
      if (!hasDiscrepancy && row.eveningReturnedFull > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: reconciliation.branchId,
            productId: row.productId,
            reconciliationId: reconciliation.id,
            type: CylinderMovementType.DAILY_RETURN_FULL,
            fullDelta: row.eveningReturnedFull,
          },
        });
      }
      if (!hasDiscrepancy && row.eveningReturnedEmpty > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: reconciliation.branchId,
            productId: row.productId,
            reconciliationId: reconciliation.id,
            type: CylinderMovementType.DAILY_RETURN_EMPTY,
            emptyDelta: row.eveningReturnedEmpty,
          },
        });
      }

      await logAction(
        currentUser.id,
        "UPDATE_RECONCILIATION",
        "DailyReconciliationItem",
        updatedItem.id,
        auditSnapshot(currentItem),
        auditSnapshot(updatedItem),
        { tx },
      );
    }

    const reconciliationAfter = await tx.dailyReconciliation.findUniqueOrThrow({
      where: { id: reconciliation.id },
      include: {
        items: {
          include: { product: true },
          orderBy: { productId: "asc" },
        },
        branch: true,
        salesman: true,
        loader: true,
      },
    });

    await logAction(
      currentUser.id,
      "UPDATE_RECONCILIATION",
      "DailyReconciliation",
      reconciliation.id,
      reconciliationBefore,
      auditSnapshot(reconciliationAfter),
      { tx },
    );
  });

  revalidatePath("/loader");
  revalidatePath("/finance/reconciliation-overview");
  redirect(`/loader/return/${encodeURIComponent(salesmanId)}`);
}

export async function submitMorningLoad(formData: FormData) {
  const salesmanId = text(formData, "salesmanId");

  if (!salesmanId) {
    throw new Error("Select a salesman.");
  }

  await processMorningLoad(formData);
}

export async function submitEveningReconcile(formData: FormData) {
  const salesmanId = text(formData, "salesmanId");

  if (!salesmanId) {
    throw new Error("Select a salesman.");
  }

  await processEveningReturn(formData);
}
