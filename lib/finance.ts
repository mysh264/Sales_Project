import { Prisma } from "@/generated/prisma/client";

export function debtCollectionsByCurrency(
  payments: Array<{ currency: string; amount: Prisma.Decimal }>,
): Record<string, string> {
  const totals: Record<string, Prisma.Decimal> = {};
  for (const payment of payments) {
    const currency = payment.currency || "OMR";
    totals[currency] = (totals[currency] ?? new Prisma.Decimal(0)).add(payment.amount);
  }
  return Object.fromEntries(
    Object.entries(totals).map(([currency, amount]) => [currency, amount.toFixed(3)]),
  );
}
