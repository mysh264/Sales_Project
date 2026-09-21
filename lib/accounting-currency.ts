import { Prisma } from "@/generated/prisma/client";

export const ALLOWED_INVOICE_CURRENCIES = new Set(["OMR", "USD", "AED"]);

export function normalizeCurrency(value: string | null | undefined, fallback = "OMR"): string {
  const normalized = (value ?? "").trim().toUpperCase();
  return ALLOWED_INVOICE_CURRENCIES.has(normalized) ? normalized : fallback;
}

/**
 * Branch default currency is the customer's single accounting currency.
 * Free invoice currency override is allowed only when the customer has no credit
 * balance and no open debts — otherwise credit/limit math would mix units.
 */
export function resolveInvoiceCurrency(input: {
  submittedCurrency: string;
  branchDefaultCurrency: string | null | undefined;
  creditBalance: Prisma.Decimal | number | string;
  openDebtCurrencies: string[];
}): string {
  const accounting = normalizeCurrency(input.branchDefaultCurrency, "OMR");
  const submitted = input.submittedCurrency.trim().toUpperCase();
  const wanted = ALLOWED_INVOICE_CURRENCIES.has(submitted) ? submitted : accounting;

  const credit = input.creditBalance instanceof Prisma.Decimal
    ? input.creditBalance
    : new Prisma.Decimal(input.creditBalance ?? 0);
  const openCurrencies = [...new Set(input.openDebtCurrencies.map((c) => normalizeCurrency(c, accounting)))];
  const creditOrDebtActive = credit.greaterThan(0) || openCurrencies.length > 0;

  if (!creditOrDebtActive) {
    return wanted;
  }

  if (openCurrencies.length > 1) {
    throw new Error(
      `Customer has open debts in multiple currencies (${openCurrencies.join(", ")}). Resolve them before issuing a new invoice.`,
    );
  }

  const locked = openCurrencies[0] ?? accounting;
  if (wanted !== locked) {
    throw new Error(
      `Customer accounting is locked to ${locked} while credit or open debt exists. Use ${locked} for this invoice.`,
    );
  }

  return locked;
}
