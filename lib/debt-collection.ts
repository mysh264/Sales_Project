import type { Prisma } from "@/generated/prisma/client";

export function assertDebtCollectionAvailable(requested: Prisma.Decimal, outstanding: Prisma.Decimal): void {
  if (requested.greaterThan(outstanding)) {
    throw new Error("Debt collection cannot exceed the customer's outstanding debt in this currency.");
  }
}
