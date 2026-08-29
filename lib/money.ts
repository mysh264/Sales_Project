import { Prisma } from "@/generated/prisma/client";

const DEFAULT_CURRENCY = "OMR";

export type MoneyInput = Prisma.Decimal | number | string | null | undefined;

/**
 * Format a monetary value consistently across the app.
 * Omani rial uses 3 decimal places (bz). Returns a display string like "12.350".
 * Centralizes the previously scattered `.toFixed(3)` calls so currency rendering
 * stays consistent everywhere (tables, receipts, PDFs, audit logs).
 */
export function formatMoney(amount: MoneyInput, currency: string = DEFAULT_CURRENCY): string {
  const decimal =
    amount instanceof Prisma.Decimal
      ? amount
      : new Prisma.Decimal(amount ?? 0);
  const fixed = decimal.toFixed(3);
  return `${fixed} ${currency}`;
}

/** Numeric string with fixed 3 decimals, no currency suffix (for inputs/JSON). */
export function moneyToFixed(amount: MoneyInput): string {
  const decimal = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount ?? 0);
  return decimal.toFixed(3);
}

/** Coerce any input into a Prisma.Decimal (guards against NaN/negative where needed). */
export function toDecimal(amount: MoneyInput): Prisma.Decimal {
  return amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount ?? 0);
}
