"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAction, auditSnapshot } from "@/lib/audit";
import { buildCylinderEventData } from "@/lib/cylinders";

export async function registerCylinder(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/login");

  const branchId = String(formData.get("branchId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const serial = String(formData.get("serial") ?? "").trim();
  if (!branchId || !productId || !serial) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.cylinder.findUnique({
      where: { branchId_serial: { branchId, serial } },
    });
    const cylinder = await tx.cylinder.upsert({
      where: { branchId_serial: { branchId, serial } },
      update: { productId, status: "AVAILABLE", location: "Warehouse" },
      create: { branchId, productId, serial, status: "AVAILABLE", location: "Warehouse" },
    });
    const event = await tx.cylinderEvent.create({
      data: {
        cylinderId: cylinder.id,
        branchId,
        type: "STOCK_ADJUSTMENT",
        note: `Registered by ${currentUser.fullName}`,
      },
    });

    await logAction(
      currentUser.id,
      existing ? "UPDATE_CYLINDER" : "CREATE_CYLINDER",
      "Cylinder",
      cylinder.id,
      auditSnapshot(existing ?? null),
      auditSnapshot(cylinder),
      { tx },
    );
    await logAction(
      currentUser.id,
      "CYLINDER_EVENT",
      "CylinderEvent",
      event.id,
      null,
      auditSnapshot(event),
      { tx },
    );
  });

  revalidatePath("/admin/cylinders");
}

export async function logCylinderEvent(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/login");

  const cylinderId = String(formData.get("cylinderId") ?? "").trim();
  const type = String(formData.get("type") ?? "STOCK_ADJUSTMENT");
  const status = String(formData.get("status") ?? "AVAILABLE");
  const note = String(formData.get("note") ?? "").trim();
  if (!cylinderId) throw new Error("Select a cylinder.");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.cylinder.findUniqueOrThrow({ where: { id: cylinderId } });
    const data = buildCylinderEventData(existing, { type, status, note });
    const event = await tx.cylinderEvent.create({
      data: {
        cylinderId: data.cylinderId,
        branchId: data.branchId,
        type: data.type,
        note: data.note,
      },
    });
    const updated = await tx.cylinder.update({
      where: { id: cylinderId },
      data: { status: data.status },
    });

    await logAction(
      currentUser.id,
      "UPDATE_CYLINDER_STATUS",
      "Cylinder",
      cylinderId,
      auditSnapshot(existing),
      auditSnapshot(updated),
      { tx },
    );
    await logAction(
      currentUser.id,
      "CYLINDER_EVENT",
      "CylinderEvent",
      event.id,
      null,
      auditSnapshot(event),
      { tx },
    );
  });

  revalidatePath("/admin/cylinders");
}
