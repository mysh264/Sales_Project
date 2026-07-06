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

function slugify(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function saveBranch(formData: FormData) {
  const branchId = text(formData, "branchId") || null;
  const name = text(formData, "name");
  const location = text(formData, "location");
  const code = text(formData, "code");

  if (!name) {
    throw new Error("Branch name is required.");
  }

  await requirePermission(Permissions.Branches_Update);

  const company = await prisma.company.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
  });

  const branchCode = code || slugify(name);

  await prisma.$transaction(async (tx) => {
    if (branchId) {
      const existing = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
      const updated = await tx.branch.update({
        where: { id: branchId },
        data: {
          name,
          location: location || null,
          code: branchCode,
        },
      });

      await logAction(
        existing.id,
        "UPDATE_BRANCH",
        "Branch",
        updated.id,
        auditSnapshot(existing),
        auditSnapshot(updated),
        { tx },
      );
    } else {
      const created = await tx.branch.create({
        data: {
          companyId: company.id,
          name,
          location: location || null,
          code: branchCode,
          defaultCurrency: "OMR",
          defaultPhoneCode: "+968",
          defaultTaxRate: "5.0000",
        },
      });

      await logAction(
        created.id,
        "CREATE_BRANCH",
        "Branch",
        created.id,
        null,
        auditSnapshot(created),
        { tx },
      );
    }
  });

  revalidatePath("/admin/branches");
  revalidatePath("/general-manager/users");
  revalidatePath("/admin");
  redirect("/admin/branches");
}
