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

export function roundMoney(amount: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(toDecimal(amount).toFixed(3));
}

export function roundRate(amount: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(toDecimal(amount).toFixed(4));
}

/**
 * Financial invariant: paid + debt + written-off debt must equal the invoice total.
 * Returns true when the stored-scale values reconcile exactly.
 * Used both in tests/audits and as a defensive check after mutations.
 */
export function isInvoiceBalanced(args: {
  totalAmount: MoneyInput;
  paidAmount: MoneyInput;
  debtAmount: MoneyInput;
  writtenOffAmount?: MoneyInput;
}): boolean {
  const total = roundMoney(args.totalAmount);
  const paid = roundMoney(args.paidAmount);
  const debt = roundMoney(args.debtAmount);
  const writtenOff = roundMoney(args.writtenOffAmount ?? 0);
  return total.equals(paid.add(debt).add(writtenOff));
}
