"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permission-guard";
import { Permissions } from "@/lib/permissions";

export type CustomerSearchResult = {
  id: string;
  name: string;
  phone: string;
  address: string;
  vatNumber: string;
};

// Server-side customer search. Keeps the full branch customer list off the client and
// returns only the matching slice. Branch-scoped to the caller's branch for non-global users.
export async function searchCustomers(query: string): Promise<CustomerSearchResult[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }
  await requirePermission(Permissions.Sales_Create);

  const branchId = user.branchId;
  const normalized = query.trim();

  const customers = await prisma.customer.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(normalized
        ? {
            OR: [
              { name: { contains: normalized, mode: "insensitive" } },
              { phone: { contains: normalized, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      vatNumber: true,
    },
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    vatNumber: customer.vatNumber ?? "",
  }));
}
