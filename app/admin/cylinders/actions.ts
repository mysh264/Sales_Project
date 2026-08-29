"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function registerCylinder(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/login");

  const branchId = String(formData.get("branchId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const serial = String(formData.get("serial") ?? "").trim();
  if (!branchId || !productId || !serial) return;

  await prisma.cylinder.upsert({
    where: { branchId_serial: { branchId, serial } },
    update: { productId, status: "AVAILABLE", location: "Warehouse" },
    create: { branchId, productId, serial, status: "AVAILABLE", location: "Warehouse" },
  });

  const cylinder = await prisma.cylinder.findUniqueOrThrow({
    where: { branchId_serial: { branchId, serial } },
  });

  await prisma.cylinderEvent.create({
    data: {
      cylinderId: cylinder.id,
      branchId,
      type: "STOCK_ADJUSTMENT",
      note: `Registered by ${currentUser.fullName}`,
    },
  });

  revalidatePath("/admin/cylinders");
}
