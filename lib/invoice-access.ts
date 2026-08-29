import type { Prisma, User, UserRole } from "@/generated/prisma/client";

type InvoiceViewer = Pick<
  User,
  "id" | "role" | "branchId" | "hasGlobalAccess" | "allowGlobalSalesView"
> | null | undefined;

export function invoiceAccessWhere(user: InvoiceViewer): Prisma.InvoiceWhereInput {
  if (!user) {
    return { id: "__unauthorized__" };
  }

  if (user.role === "ADMIN" || user.role === "GENERAL_MANAGER" || user.hasGlobalAccess || user.allowGlobalSalesView) {
    return {};
  }

  if (user.role === ("SALESMAN" satisfies UserRole)) {
    return { salesmanId: user.id };
  }

  return user.branchId ? { branchId: user.branchId } : { id: "__unauthorized__" };
}
