"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, auditSnapshot } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSku(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function saveProduct(formData: FormData) {
  const productId = text(formData, "productId") || null;
  const sku = normalizeSku(text(formData, "sku"));
  const name = text(formData, "name");
  const gasType = text(formData, "gasType");
  const cylinderSize = text(formData, "cylinderSize");
  const pressure = text(formData, "pressure");
  const unitLabel = text(formData, "unitLabel") || "Cylinder";

  if (!name || !gasType || !cylinderSize) {
    throw new Error("Name, gas type, and cylinder size are required.");
  }

  await requirePermission(Permissions.PRODUCT_MANAGE);

  await prisma.$transaction(async (tx) => {
    if (productId) {
      const existing = await tx.product.findUniqueOrThrow({
        where: { id: productId },
      });

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          branchId: null,
          sku: sku || existing.sku,
          name,
          gasType,
          cylinderSize,
          pressure: pressure || null,
          unitLabel,
        },
      });

      await logAction(
        existing.id,
        "UPDATE_PRODUCT",
        "Product",
        updated.id,
        auditSnapshot(existing),
        auditSnapshot(updated),
        { tx },
      );
    } else {
      if (!sku) {
        throw new Error("SKU is required.");
      }

      const created = await tx.product.create({
        data: {
          branchId: null,
          sku,
          name,
          gasType,
          cylinderSize,
          pressure: pressure || null,
          unitLabel,
          isActive: true,
        },
      });

      await logAction(
        created.id,
        "CREATE_PRODUCT",
        "Product",
        created.id,
        null,
        auditSnapshot(created),
        { tx },
      );
    }
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/admin-console");
  redirect("/admin/products");
}

export async function toggleProductStatus(formData: FormData) {
  const productId = text(formData, "productId");
  const currentStatus = text(formData, "currentStatus") === "true";

  if (!productId) {
    throw new Error("Missing product.");
  }

  await requirePermission(Permissions.PRODUCT_MANAGE);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    const updated = await tx.product.update({
      where: { id: productId },
      data: { isActive: !currentStatus },
    });

    await logAction(
      existing.id,
      currentStatus ? "DELETE_PRODUCT" : "RESTORE_PRODUCT",
      "Product",
      updated.id,
      auditSnapshot(existing),
      auditSnapshot(updated),
      { tx },
    );
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/admin-console");
}
