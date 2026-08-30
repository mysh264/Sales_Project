"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAction, auditSnapshot } from "@/lib/audit";

export async function registerCylinder(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/login");

  const branchId = String(formData.get("branchId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const serial = String(formData.get("serial") ?? "").trim();
  if (!branchId || !productId || !serial) return;

  const existing = await prisma.cylinder.findUnique({
    where: { branchId_serial: { branchId, serial } },
  });

  await prisma.cylinder.upsert({
    where: { branchId_serial: { branchId, serial } },
    update: { productId, status: "AVAILABLE", location: "Warehouse" },
    create: { branchId, productId, serial, status: "AVAILABLE", location: "Warehouse" },
  });

  const cylinder = await prisma.cylinder.findUniqueOrThrow({
    where: { branchId_serial: { branchId, serial } },
  });

  const event = await prisma.cylinderEvent.create({
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
  );
  await logAction(
    currentUser.id,
    "CYLINDER_EVENT",
    "CylinderEvent",
    event.id,
    null,
    auditSnapshot(event),
  );

  revalidatePath("/admin/cylinders");
}
