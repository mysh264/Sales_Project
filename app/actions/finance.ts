"use server";

import { DebtStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { branchWhere, getBranchScope } from "@/lib/branch-scope";
import { requirePermission } from "@/lib/permission-guard";
import { Permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { businessDayRange } from "@/lib/business-date";
import { debtCollectionsByCurrency } from "@/lib/finance";

function startOfDay() {
  return businessDayRange().start;
}

function endOfDay() {
  return businessDayRange().end;
}

function decimalToString(value: Prisma.Decimal | number | null | undefined) {
  if (value instanceof Prisma.Decimal) {
    return value.toFixed(3);
  }

  return new Prisma.Decimal(value ?? 0).toFixed(3);
}

export type CurrencyTotals = {
  sales: string;
  vat: string;
  debtCollected: string;
  outstandingDebt: string;
};

export type FinancialSummary = {
  scope: "global" | "branch";
  scopeLabel: string;
  // Per-currency breakdown. Headline fields below mirror the branch's reporting currency
  // (or OMR when global) so existing UI keeps working; the map is the source of truth.
  byCurrency: Record<string, CurrencyTotals>;
  totalSalesToday: string;
  totalVatToday: string;
  totalOutstandingDebt: string;
  debtCollectedToday: string;
};

export type FinancialSummaryFilters = {
  startDate?: Date;
  endDateExclusive?: Date;
  branchId?: string | null;
  salesmanId?: string | null;
};

export async function getFinancialSummary(filters: FinancialSummaryFilters = {}): Promise<FinancialSummary> {
  const { user } = await requirePermission(Permissions.Finance_Read);
  const scope = await getBranchScope();
  const globalAccess = Boolean(scope?.canSeeAllBranches);
  const dayStart = filters.startDate ?? startOfDay();
  const dayEnd = filters.endDateExclusive ?? endOfDay();
  const branchFilter = branchWhere(scope);
  const targetBranchId = globalAccess ? filters.branchId ?? null : scope?.branchId ?? null;
  const targetSalesmanId = filters.salesmanId ?? null;

  const invoiceBranchFilter = globalAccess
    ? targetBranchId
      ? { branchId: targetBranchId }
      : undefined
    : branchFilter;

  const invoiceSalesmanFilter = targetSalesmanId ? { salesmanId: targetSalesmanId } : undefined;

  const invoiceWhere = {
    ...(invoiceBranchFilter ?? {}),
    ...(invoiceSalesmanFilter ?? {}),
    status: "ISSUED",
    createdAt: {
      gte: dayStart,
      lt: dayEnd,
    },
  } satisfies Prisma.InvoiceWhereInput;

  const debtWhere: Prisma.CustomerDebtWhereInput = {
    invoice:
      invoiceBranchFilter || targetSalesmanId
        ? {
            ...(invoiceBranchFilter ?? {}),
            ...(targetSalesmanId ? { salesmanId: targetSalesmanId } : {}),
          }
        : undefined,
    status: {
      in: [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID],
    },
  };

  const [invoiceGroups, debts, debtPayments] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["currency"],
      where: invoiceWhere,
      _sum: {
        subtotalAmount: true,
        taxAmount: true,
      },
    }),
    prisma.customerDebt.findMany({
      where: debtWhere,
      include: { invoice: { select: { currency: true } } },
    }),
    prisma.debtPayment.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
        method: { not: PaymentMethod.WRITE_OFF },
        debt: {
          invoice:
            invoiceBranchFilter || targetSalesmanId
              ? {
                  ...(invoiceBranchFilter ?? {}),
                  ...(targetSalesmanId ? { salesmanId: targetSalesmanId } : {}),
                }
              : undefined,
        },
      },
      select: {
        amount: true,
        debt: { select: { invoice: { select: { currency: true } } } },
      },
    }),
  ]);

  const byCurrency: Record<string, CurrencyTotals> = {};
  for (const group of invoiceGroups) {
    const currency = group.currency || "OMR";
    byCurrency[currency] = {
      sales: decimalToString(group._sum.subtotalAmount),
      vat: decimalToString(group._sum.taxAmount),
      debtCollected: "0.000",
      outstandingDebt: "0.000",
    };
  }
  for (const debt of debts) {
    const currency = debt.invoice.currency || "OMR";
    const existing = byCurrency[currency] ?? { sales: "0.000", vat: "0.000", debtCollected: "0.000", outstandingDebt: "0.000" };
    existing.outstandingDebt = decimalToString(new Prisma.Decimal(existing.outstandingDebt).add(debt.balanceAmount));
    byCurrency[currency] = existing;
  }
  const debtCollections = debtCollectionsByCurrency(
    debtPayments.map((payment) => ({
      currency: payment.debt.invoice.currency || "OMR",
      amount: payment.amount,
    })),
  );
  for (const [currency, amount] of Object.entries(debtCollections)) {
    const existing = byCurrency[currency] ?? {
      sales: "0.000",
      vat: "0.000",
      debtCollected: "0.000",
      outstandingDebt: "0.000",
    };
    existing.debtCollected = amount;
    byCurrency[currency] = existing;
  }

  const reportingCurrency = user.branch?.defaultCurrency || "OMR";
  const primary = byCurrency[reportingCurrency] ?? Object.values(byCurrency)[0] ?? {
    sales: "0.000",
    vat: "0.000",
    debtCollected: "0.000",
    outstandingDebt: "0.000",
  };

  return {
    scope: globalAccess ? "global" : "branch",
    scopeLabel: globalAccess ? "Global" : user.branch?.name ?? "Branch",
    byCurrency,
    totalSalesToday: primary.sales,
    totalVatToday: primary.vat,
    totalOutstandingDebt: primary.outstandingDebt,
    debtCollectedToday: primary.debtCollected,
  };
}
