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

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const { user } = await requirePermission(Permissions.FINANCE_VIEW);
  const scope = await getBranchScope();
  const globalAccess = Boolean(scope?.canSeeAllBranches);
  const dayStart = startOfDay();
  const dayEnd = endOfDay();
  const branchFilter = branchWhere(scope);

  const [invoiceTotals, debtTotals] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        ...branchFilter,
        status: "ISSUED",
        createdAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      _sum: {
        subtotalAmount: true,
        taxAmount: true,
        debtCollectionAmount: true,
      },
    }),
    prisma.customerDebt.aggregate({
      where: {
        ...branchFilter,
        status: {
          in: [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID],
        },
        createdAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
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
