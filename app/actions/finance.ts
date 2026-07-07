"use server";

import { DebtStatus, Prisma } from "@prisma/client";
import { branchWhere, getBranchScope } from "@/lib/branch-scope";
import { requirePermission } from "@/lib/permission-guard";
import { Permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function startOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

function decimalToString(value: Prisma.Decimal | number | null | undefined) {
  if (value instanceof Prisma.Decimal) {
    return value.toFixed(3);
  }

  return new Prisma.Decimal(value ?? 0).toFixed(3);
}

export type FinancialSummary = {
  scope: "global" | "branch";
  scopeLabel: string;
  totalSalesToday: string;
  totalVatToday: string;
  totalOutstandingDebtToday: string;
  pendingDebtCollectionToday: string;
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
    createdAt: {
      gte: dayStart,
      lt: dayEnd,
    },
  };

  const [invoiceTotals, debtTotals] = await Promise.all([
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: {
        subtotalAmount: true,
        taxAmount: true,
        debtCollectionAmount: true,
      },
    }),
    prisma.customerDebt.aggregate({
      where: debtWhere,
      _sum: {
        balanceAmount: true,
      },
    }),
  ]);

  return {
    scope: globalAccess ? "global" : "branch",
    scopeLabel: globalAccess ? "Global" : user.branch?.name ?? "Branch",
    totalSalesToday: decimalToString(invoiceTotals._sum.subtotalAmount),
    totalVatToday: decimalToString(invoiceTotals._sum.taxAmount),
    totalOutstandingDebtToday: decimalToString(debtTotals._sum.balanceAmount),
    pendingDebtCollectionToday: decimalToString(invoiceTotals._sum.debtCollectionAmount),
  };
}
