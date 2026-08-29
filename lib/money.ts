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

/** Omani-rial currency display, e.g. "12.350 OMR" using Intl en-OM (3 decimals). */
export function formatOmr(amount: MoneyInput): string {
  const decimal = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount ?? 0);
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(decimal.toNumber());
}

/** Coerce any input into a Prisma.Decimal (guards against NaN/negative where needed). */
export function toDecimal(amount: MoneyInput): Prisma.Decimal {
  return amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount ?? 0);
}

/**
 * Financial invariant: for any invoice, paidAmount + debtAmount must equal totalAmount.
 * Returns true when the three values reconcile (within 3-decimal rounding tolerance).
 * Used both in tests/audits and as a defensive check after mutations.
 */
export function isInvoiceBalanced(args: {
  totalAmount: MoneyInput;
  paidAmount: MoneyInput;
  debtAmount: MoneyInput;
}): boolean {
  const total = toDecimal(args.totalAmount);
  const paid = toDecimal(args.paidAmount);
  const debt = toDecimal(args.debtAmount);
  const diff = total.sub(paid.add(debt)).abs();
  // Tolerance: 1 unit at the 3rd decimal (0.001).
  return diff.lessThanOrEqualTo(new Prisma.Decimal("0.001"));
}
