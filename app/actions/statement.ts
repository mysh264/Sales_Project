"use server";

import { redirect } from "next/navigation";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { branchWhere, getBranchScope } from "@/lib/branch-scope";
import { mintStatementToken } from "@/lib/statement-token";

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

  const { token, tokenHash } = mintStatementToken();
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.customer.update({
    where: { id: customerId },
    data: { shareToken: tokenHash, shareTokenExpires: expires },
  });

  return token;
}
