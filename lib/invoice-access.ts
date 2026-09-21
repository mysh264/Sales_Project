import type { Prisma, Role, User, UserRole } from "@/generated/prisma/client";
import { hasAnyPermission, Permissions } from "@/lib/permissions";

type InvoiceViewer = Pick<
  User,
  "id" | "role" | "branchId" | "hasGlobalAccess" | "allowGlobalSalesView"
> & { roleProfile?: Pick<Role, "permissions"> | null } | null | undefined;

type AttachmentViewer = Pick<User, "role"> & {
  roleProfile?: Pick<Role, "permissions"> | null;
} | null | undefined;

export function canReadPaymentAttachment(user: AttachmentViewer): boolean {
  return hasAnyPermission(user, [Permissions.Sales_Read, Permissions.Finance_Read]);
}

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
