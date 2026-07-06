"use server";

import { CylinderMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function intValue(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key) || "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function resolveBranchUser(branchId: string, preferredRole: "LOADER" | "SALESMAN") {
  const preferred = await prisma.user.findFirst({
    where: { branchId, role: preferredRole, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (preferred) {
    return preferred;
  }

  return prisma.user.findFirst({
    where: { branchId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function processMorningLoad(formData: FormData) {
  const truckId = text(formData, "truckId");
  const productIds = formData.getAll("productId").filter((value): value is string => typeof value === "string");

  if (!truckId) {
    throw new Error("Missing truck.");
  }

  await requirePermission(Permissions.INVENTORY_UPDATE);

  await prisma.$transaction(async (tx) => {
    const truck = await tx.truck.findUniqueOrThrow({
      where: { id: truckId },
      include: { salesman: true },
    });

    const activeSession = await tx.truckLoadSession.findFirst({
      where: { truckId: truck.id, returnedAt: null },
    });

    if (activeSession) {
      throw new Error("This truck already has an active load session.");
    }

    const salesman =
      truck.salesman ??
      (await tx.user.findFirst({
        where: { branchId: truck.branchId, role: "SALESMAN", isActive: true },
        orderBy: { createdAt: "asc" },
      }));

    const loader =
      (await tx.user.findFirst({
        where: { branchId: truck.branchId, role: "LOADER", isActive: true },
        orderBy: { createdAt: "asc" },
      })) ??
      (await tx.user.findFirst({
        where: { branchId: truck.branchId, isActive: true },
        orderBy: { createdAt: "asc" },
      }));

    if (!salesman || !loader) {
      throw new Error("Truck needs an assigned salesman and loader user before loading.");
    }

    const loadItems = productIds
      .map((productId) => ({
        productId,
        fullCylindersLoad: intValue(formData, `product-${productId}-loaded`),
      }))
      .filter((item) => item.fullCylindersLoad > 0);

    if (loadItems.length === 0) {
      throw new Error("Enter at least one loaded cylinder quantity.");
    }

    const session = await tx.truckLoadSession.create({
      data: {
        truckId: truck.id,
        salesmanId: salesman.id,
        loaderId: loader.id,
      },
    });

    await logAction(
      loader.id,
      "PROCESS_MORNING_LOAD",
      "TruckLoadSession",
      session.id,
      null,
      auditSnapshot({
        id: session.id,
        truckId: session.truckId,
        salesmanId: session.salesmanId,
        loaderId: session.loaderId,
        loadedAt: session.loadedAt,
      }),
      { tx },
    );

    await tx.truckLoadItem.createMany({
      data: loadItems.map((item) => ({
        sessionId: session.id,
        productId: item.productId,
        fullCylindersLoad: item.fullCylindersLoad,
      })),
    });

    for (const item of loadItems) {
      const inventoryBefore = await tx.inventoryBalance.findUnique({
        where: { branchId_productId: { branchId: truck.branchId, productId: item.productId } },
      });

      await tx.cylinderMovement.create({
        data: {
          branchId: truck.branchId,
          productId: item.productId,
          loadSessionId: session.id,
          type: CylinderMovementType.TRUCK_LOAD_FULL,
          fullDelta: -item.fullCylindersLoad,
        },
      });

      await tx.inventoryBalance.upsert({
        where: { branchId_productId: { branchId: truck.branchId, productId: item.productId } },
        update: {
          fullCount: { decrement: item.fullCylindersLoad },
        },
        create: {
          branchId: truck.branchId,
          productId: item.productId,
          fullCount: -item.fullCylindersLoad,
          emptyCount: 0,
        },
      });

      const inventoryAfter = await tx.inventoryBalance.findUniqueOrThrow({
        where: { branchId_productId: { branchId: truck.branchId, productId: item.productId } },
      });

      await logAction(
        loader.id,
        "UPDATE_INVENTORY",
        "InventoryBalance",
        inventoryAfter.id,
        auditSnapshot(inventoryBefore),
        auditSnapshot(inventoryAfter),
        { tx },
      );
    }
  });

  revalidatePath("/loader");
  redirect("/loader");
}

export async function processEveningReturn(formData: FormData) {
  const sessionId = text(formData, "sessionId");
  const productIds = formData.getAll("productId").filter((value): value is string => typeof value === "string");

  if (!sessionId) {
    throw new Error("Missing load session.");
  }

  await requirePermission(Permissions.INVENTORY_UPDATE);

  await prisma.$transaction(async (tx) => {
    const session = await tx.truckLoadSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { truck: true },
    });

    if (session.returnedAt) {
      throw new Error("This truck load session has already been returned.");
    }

    const returnItems = productIds
      .map((productId) => ({
        productId,
        remainingFullCount: intValue(formData, `product-${productId}-remaining-full`),
        collectedEmptyCount: intValue(formData, `product-${productId}-collected-empty`),
      }))
      .filter((item) => item.remainingFullCount > 0 || item.collectedEmptyCount > 0);

    if (returnItems.length === 0) {
      throw new Error("Enter at least one return quantity.");
    }

    const returnedAt = new Date();

    await tx.truckLoadSession.update({
      where: { id: session.id },
      data: { returnedAt },
    });

    await logAction(
      session.loaderId,
      "PROCESS_EVENING_RETURN",
      "TruckLoadSession",
      session.id,
      auditSnapshot(session),
      auditSnapshot({
        ...session,
        returnedAt,
      }),
      { tx },
    );

    await tx.truckReturnItem.createMany({
      data: returnItems.map((item) => ({
        sessionId: session.id,
        productId: item.productId,
        remainingFullCount: item.remainingFullCount,
        collectedEmptyCount: item.collectedEmptyCount,
      })),
    });

    for (const item of returnItems) {
      const inventoryBefore = await tx.inventoryBalance.findUnique({
        where: { branchId_productId: { branchId: session.truck.branchId, productId: item.productId } },
      });

      if (item.remainingFullCount > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: session.truck.branchId,
            productId: item.productId,
            loadSessionId: session.id,
            type: CylinderMovementType.TRUCK_RETURN_FULL,
            fullDelta: item.remainingFullCount,
          },
        });
      }

      if (item.collectedEmptyCount > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: session.truck.branchId,
            productId: item.productId,
            loadSessionId: session.id,
            type: CylinderMovementType.TRUCK_RETURN_EMPTY,
            emptyDelta: item.collectedEmptyCount,
          },
        });
      }

      await tx.inventoryBalance.upsert({
        where: { branchId_productId: { branchId: session.truck.branchId, productId: item.productId } },
        update: {
          fullCount: { increment: item.remainingFullCount },
          emptyCount: { increment: item.collectedEmptyCount },
        },
        create: {
          branchId: session.truck.branchId,
          productId: item.productId,
          fullCount: item.remainingFullCount,
          emptyCount: item.collectedEmptyCount,
        },
      });

      const inventoryAfter = await tx.inventoryBalance.findUniqueOrThrow({
        where: { branchId_productId: { branchId: session.truck.branchId, productId: item.productId } },
      });

      await logAction(
        session.loaderId,
        "UPDATE_INVENTORY",
        "InventoryBalance",
        inventoryAfter.id,
        auditSnapshot(inventoryBefore),
        auditSnapshot(inventoryAfter),
        { tx },
      );
    }
  });

  revalidatePath("/loader");
  redirect("/loader");
}
