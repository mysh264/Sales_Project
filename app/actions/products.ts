"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, auditSnapshot } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { toggledState } from "@/lib/toggle-state";

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

  const { user: actor } = await requirePermission(Permissions.Products_Update);

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
        actor.id,
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
      const branches = await tx.branch.findMany({ select: { id: true } });
      if (branches.length > 0) {
        await tx.inventoryBalance.createMany({
          data: branches.map((branch) => ({
            branchId: branch.id,
            productId: created.id,
            fullCount: 0,
            emptyCount: 0,
          })),
          skipDuplicates: true,
        });
      }

      await logAction(
        actor.id,
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
  revalidatePath("/general-manager/products");
  revalidatePath("/admin");
  revalidatePath("/admin-console");
  redirect("/admin/products");
}

export async function toggleProductStatus(formData: FormData) {
  const productId = text(formData, "productId");

  if (!productId) {
    throw new Error("Missing product.");
  }

  const { user: actor } = await requirePermission(Permissions.Products_Update);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    const nextStatus = toggledState(existing.isActive);
    const updated = await tx.product.update({
      where: { id: productId },
      data: { isActive: nextStatus },
    });

    await logAction(
      actor.id,
      existing.isActive ? "DELETE_PRODUCT" : "RESTORE_PRODUCT",
      "Product",
      updated.id,
      auditSnapshot(existing),
      auditSnapshot(updated),
      { tx },
    );
  });

  revalidatePath("/admin/products");
  revalidatePath("/general-manager/products");
  revalidatePath("/admin");
  revalidatePath("/admin-console");
}
