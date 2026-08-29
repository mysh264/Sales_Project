"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { branchWhere, getBranchScope } from "@/lib/branch-scope";

const TOKEN_TTL_DAYS = 30;

export async function generateStatementShareToken(formData: FormData) {
  await requirePermission(Permissions.Finance_Read);
  const scope = await getBranchScope();
  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) redirect("/finance/statements");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...branchWhere(scope) },
  });
  if (!customer) redirect("/finance/statements");

  const token = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.customer.update({
    where: { id: customerId },
    data: { shareToken: token, shareTokenExpires: expires },
  });

  return token;
}
