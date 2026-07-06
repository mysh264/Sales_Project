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

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function intValue(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key) || "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function dayOnly(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
    return true;
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

    if (reconciliation.status === ReconciliationStatus.EVENING_RECONCILED) {
      throw new Error("This route has already been completed.");
    }

    const itemMap = new Map<string, (typeof reconciliation.items)[number]>(
      reconciliation.items.map((item) => [item.productId, item]),
    );

    for (const row of normalizedList) {
      const item = itemMap.get(row.productId);

      if (!item) {
        throw new Error("Evening reconciliation must include the morning load products.");
      }

      const soldFull = item.morningFull - row.eveningReturnedFull;
      if (soldFull < 0) {
        throw new Error("Returned full cylinders cannot exceed morning load.");
      }

      row.eveningReturnedEmpty = soldFull;
    }

    const reconciliationBefore = auditSnapshot(reconciliation);

    await tx.dailyReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: ReconciliationStatus.EVENING_RECONCILED,
        eveningReconciledAt: new Date(),
      },
    });

    for (const row of normalizedList) {
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
