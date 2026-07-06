"use server";

import { ReconciliationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";

type MorningLoadItem = {
  productId: string;
  morningFull: number;
};

type EveningReconcileItem = {
  productId: string;
  morningFull: number;
  eveningReturnedFull: number;
  eveningReturnedEmpty: number;
};

function dayOnly(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseSelection(formData: FormData) {
  const value = formData.get("salesmanId");
  return {
    salesmanId: typeof value === "string" ? value.trim() : "",
  };
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

export async function recordMorningLoad(salesmanId: string, productList: MorningLoadItem[]) {
  const { user: currentUser } = await requirePermission(Permissions.Logistics_Update);
  const targetSalesman = await prisma.user.findUniqueOrThrow({
    where: { id: salesmanId },
    include: { branch: true },
  });

  if (!currentUser.branchId && currentUser.role !== "ADMIN") {
    throw new Error("Branch-scoped logistics access is required.");
  }

  if (currentUser.role !== "ADMIN" && currentUser.branchId !== targetSalesman.branchId) {
    throw new Error("You can only reconcile salesmen in your own branch.");
  }

  const branchId = targetSalesman.branchId ?? currentUser.branchId;
  if (!branchId) {
    throw new Error("Salesman must belong to a branch.");
  }

  const rows = normalizeProductRows(
    productList
      .filter((item) => item.morningFull > 0)
      .map((item) => ({
        ...item,
        eveningReturnedFull: 0,
        eveningReturnedEmpty: 0,
      })),
  ).map((item) => ({ productId: item.productId, morningFull: item.morningFull }));

  if (rows.length === 0) {
    throw new Error("Enter at least one morning load quantity.");
  }

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
      throw new Error("This salesman already has a completed reconciliation for today.");
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

    const productIds = rows.map((row) => row.productId);
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== rows.length) {
      throw new Error("One or more selected products are not available for this workflow.");
    }

    const beforeSnapshot = existing ? auditSnapshot(existing) : null;

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

    const createdItems = await tx.dailyReconciliationItem.findMany({
      where: { reconciliationId: reconciliation.id },
      include: { product: true },
      orderBy: { productId: "asc" },
    });

    const reconciliationAfter = await tx.dailyReconciliation.findUniqueOrThrow({
      where: { id: reconciliation.id },
      include: {
        items: {
          include: {
            product: true,
          },
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
      beforeSnapshot,
      auditSnapshot(reconciliationAfter),
      { tx },
    );

    for (const item of createdItems) {
      await logAction(
        currentUser.id,
        "CREATE_RECONCILIATION",
        "DailyReconciliationItem",
        item.id,
        null,
        auditSnapshot(item),
        { tx },
      );
    }
  });

  revalidatePath("/logistics/reconciliation");
  redirect(`/logistics/reconciliation?salesmanId=${encodeURIComponent(salesmanId)}`);
}

export async function recordEveningReconcile(salesmanId: string, reconciledList: EveningReconcileItem[]) {
  const { user: currentUser } = await requirePermission(Permissions.Logistics_Update);
  const targetSalesman = await prisma.user.findUniqueOrThrow({
    where: { id: salesmanId },
    include: { branch: true },
  });

  if (currentUser.role !== "ADMIN" && currentUser.branchId !== targetSalesman.branchId) {
    throw new Error("You can only reconcile salesmen in your own branch.");
  }

  const reconciliationDate = dayOnly();
  const normalizedList = normalizeProductRows(reconciledList);

  if (normalizedList.length === 0) {
    throw new Error("Enter at least one evening reconciliation row.");
  }

  await prisma.$transaction(async (tx) => {
    const reconciliation = await tx.dailyReconciliation.findUniqueOrThrow({
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

    if (reconciliation.status === ReconciliationStatus.EVENING_RECONCILED) {
      throw new Error("This reconciliation has already been completed.");
    }

    const itemMap = new Map<string, (typeof reconciliation.items)[number]>(
      reconciliation.items.map((item) => [item.productId, item]),
    );

    const normalizedRows = normalizedList.map((row) => {
      const item = itemMap.get(row.productId);

      if (!item) {
        throw new Error("Evening reconciliation must include the morning load products.");
      }

      const soldFull = item.morningFull - row.eveningReturnedFull;
      if (soldFull < 0) {
        throw new Error("Returned full cylinders cannot exceed morning load.");
      }

      return {
        ...row,
        eveningReturnedEmpty: soldFull,
      };
    });

    for (const row of normalizedRows) {
      const item = itemMap.get(row.productId);

      if (!item) {
        throw new Error("Evening reconciliation must include the morning load products.");
      }

      const soldFull = item.morningFull - row.eveningReturnedFull;
      if (soldFull < 0) {
        throw new Error("Returned full cylinders cannot exceed morning load.");
      }
    }

    const reconciliationBefore = auditSnapshot(reconciliation);

    await tx.dailyReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: ReconciliationStatus.EVENING_RECONCILED,
        eveningReconciledAt: new Date(),
      },
    });

    for (const row of normalizedRows) {
      const currentItem = itemMap.get(row.productId)!;
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
          soldFull: currentItem.morningFull - row.eveningReturnedFull,
        },
      });

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
          include: {
            product: true,
          },
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

  revalidatePath("/logistics/reconciliation");
  redirect(`/logistics/reconciliation?salesmanId=${encodeURIComponent(salesmanId)}`);
}

export async function submitMorningLoad(formData: FormData) {
  const salesmanId = parseSelection(formData).salesmanId;
  const rows = parseRows(formData, "morningFull");
  if (!salesmanId) {
    throw new Error("Select a salesman.");
  }

  await recordMorningLoad(salesmanId, rows.map((row) => ({ productId: row.productId, morningFull: row.morningFull })));
}

export async function submitEveningReconcile(formData: FormData) {
  const salesmanId = parseSelection(formData).salesmanId;
  const rows = parseRows(formData, "morningFull", "eveningReturnedFull", "eveningReturnedEmpty");
  if (!salesmanId) {
    throw new Error("Select a salesman.");
  }

  await recordEveningReconcile(
    salesmanId,
    rows.map((row) => ({
      productId: row.productId,
      morningFull: row.morningFull,
      eveningReturnedFull: row.eveningReturnedFull,
      eveningReturnedEmpty: row.eveningReturnedEmpty,
    })),
  );
}
