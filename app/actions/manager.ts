"use server";

import {
  CylinderMovementType,
  DebtStatus,
  PaymentMethod,
  Prisma,
  ReconciliationStatus,
  UserRole,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { getBranchScope, requireBranchAccess } from "@/lib/branch-scope";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(formData: FormData, key: string) {
  const value = text(formData, key);
  if (value === "" || value == null) {
    return new Prisma.Decimal(0);
  }
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite()) {
    throw new Error("Invalid amount.");
  }
  return decimal;
}

// Only real money-collection methods are permitted for debt collection. WRITE_OFF and DEBT
// are reserved for the dedicated writeOffDebt / order flows and must not be reachabe here.
const DEBT_COLLECTION_METHODS = new Set<PaymentMethod>([
  PaymentMethod.CASH,
  PaymentMethod.CHECK,
  PaymentMethod.BANK_TRANSFER,
]);

function paymentMethod(value: string) {
  if (DEBT_COLLECTION_METHODS.has(value as PaymentMethod)) {
    return value as PaymentMethod;
  }

  throw new Error("Invalid payment method.");
}

export async function updatePriceRule(formData: FormData) {
  const ruleId = text(formData, "ruleId");
  const branchId = text(formData, "branchId");
  const productId = text(formData, "productId");
  const currency = text(formData, "currency") || "OMR";
  const minPrice = money(formData, "minPrice");
  const maxPrice = money(formData, "maxPrice");

  if (!productId) {
    throw new Error("Missing product.");
  }

  if (minPrice.lessThan(0) || maxPrice.lessThanOrEqualTo(0) || minPrice.greaterThan(maxPrice)) {
    throw new Error("Price limits are invalid.");
  }

  const { user: actor } = await requirePermission(Permissions.Products_Update);
  const scope = await getBranchScope();

  await prisma.$transaction(async (tx) => {
    let updatedRule;
    let previousRule = null;

    if (ruleId) {
      previousRule = await tx.productPriceRule.findUniqueOrThrow({ where: { id: ruleId } });
      requireBranchAccess(scope, previousRule.branchId);
      await tx.productPriceRule.updateMany({
        where: {
          branchId: previousRule.branchId,
          productId: previousRule.productId,
          endsAt: null,
          id: { not: ruleId },
        },
        data: { endsAt: new Date() },
      });
      updatedRule = await tx.productPriceRule.update({
        where: { id: ruleId },
        data: {
          currency,
          minPrice,
          maxPrice,
          endsAt: null,
        },
      });
    } else {
      if (!branchId) {
        throw new Error("Missing branch.");
      }
      requireBranchAccess(scope, branchId);

      // Serialize price-rule changes per branch+product so two concurrent saves cannot
      // both close the prior rule and commit two overlapping active (endsAt: null) rules.
      await tx.$queryRaw<Array<{ lock_acquired: number }>>`
        SELECT 1::int AS lock_acquired
        FROM (SELECT pg_advisory_xact_lock(hashtext('price-rule'), hashtext(${branchId}), hashtext(${productId}))) AS acquired
      `;

      previousRule = await tx.productPriceRule.findFirst({
        where: {
          branchId,
          productId,
          endsAt: null,
        },
        orderBy: { startsAt: "desc" },
      });

      await tx.productPriceRule.updateMany({
        where: { branchId, productId, endsAt: null },
        data: { endsAt: new Date() },
      });

      updatedRule = await tx.productPriceRule.create({
        data: {
          branchId,
          productId,
          currency,
          minPrice,
          maxPrice,
          startsAt: new Date(),
          endsAt: null,
        },
      });
    }

    await logAction(
      actor.id,
      "UPDATE_PRICE_RULE",
      "ProductPriceRule",
      updatedRule.id,
      auditSnapshot(previousRule),
      auditSnapshot(updatedRule),
      { tx },
    );
  });

  revalidatePath("/manager/settings");
  revalidatePath("/salesman/new-order");
}

export async function collectDebt(formData: FormData) {
  const debtId = text(formData, "debtId");
  const amount = money(formData, "amount");
  const method = paymentMethod(text(formData, "method"));

  if (!debtId) {
    throw new Error("Missing debt.");
  }

  if (amount.lessThanOrEqualTo(0)) {
    throw new Error("Collection amount must be greater than zero.");
  }

  const { user: actor } = await requirePermission(Permissions.Finance_Update);
  const scope = await getBranchScope();

  await prisma.$transaction(async (tx) => {
    const debt = await tx.customerDebt.findUniqueOrThrow({
      where: { id: debtId },
      include: {
        customer: true,
        invoice: true,
      },
    });
    const debtBefore = auditSnapshot(debt);
    const invoiceBefore = auditSnapshot(debt.invoice);
    requireBranchAccess(scope, debt.customer.branchId);

    // Serialize collections on the same debt so two concurrent payments cannot both
    // validate against the old balance and double-apply, which would drive debtAmount negative.
    await tx.$queryRaw<Array<{ lock_acquired: number }>>`
      SELECT 1::int AS lock_acquired
      FROM (SELECT pg_advisory_xact_lock(hashtext('debt-collection'), hashtext(${debtId})) AS acquired
    )`;

    if (debt.balanceAmount.lessThanOrEqualTo(0)) {
      throw new Error("Debt is already paid.");
    }

    if (amount.greaterThan(debt.balanceAmount)) {
      throw new Error("Collection amount cannot exceed debt balance.");
    }

    const newBalance = debt.balanceAmount.sub(amount);
    const newStatus = newBalance.equals(0) ? DebtStatus.PAID : DebtStatus.PARTIALLY_PAID;

    await tx.debtPayment.create({
      data: {
        debtId: debt.id,
        collectedById: actor.id,
        method,
        amount,
      },
    });

    // Keep the Payment ledger in sync so cash received via debt collection is
    // reflected in sum(Payment.amount) == invoice.paidAmount invariants/reports.
    await tx.payment.create({
      data: {
        invoiceId: debt.invoiceId,
        amount,
        method,
      },
    });

    const updatedDebt = await tx.customerDebt.update({
      where: { id: debt.id },
      data: {
        balanceAmount: newBalance,
        status: newStatus,
      },
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: debt.invoiceId },
      data: {
        paidAmount: { increment: amount },
        debtAmount: { decrement: amount },
      },
    });

    await logAction(
      actor.id,
      "COLLECT_DEBT",
      "CustomerDebt",
      debt.id,
      debtBefore,
      auditSnapshot(updatedDebt),
      { tx },
    );

    await logAction(
      actor.id,
      "COLLECT_DEBT",
      "Invoice",
      debt.invoiceId,
      invoiceBefore,
      auditSnapshot(updatedInvoice),
      { tx },
    );
  });

  revalidatePath("/manager");
  revalidatePath("/salesman");
}

export async function writeOffDebt(formData: FormData) {
  const debtId = text(formData, "debtId");
  const reason = text(formData, "reason");

  if (!debtId) {
    throw new Error("Missing debt.");
  }
  if (reason.length < 5) {
    throw new Error("A write-off reason of at least 5 characters is required.");
  }

  const { user: actor } = await requirePermission(Permissions.Finance_Update);
  const scope = await getBranchScope();

  await prisma.$transaction(async (tx) => {
    const debt = await tx.customerDebt.findUniqueOrThrow({
      where: { id: debtId },
      include: {
        customer: true,
        invoice: true,
      },
    });
    const debtBefore = auditSnapshot(debt);
    const invoiceBefore = auditSnapshot(debt.invoice);
    requireBranchAccess(scope, debt.customer.branchId);

    if (debt.status === DebtStatus.WRITTEN_OFF || debt.status === DebtStatus.PAID) {
      throw new Error("This debt can no longer be written off.");
    }

    const writtenOffAmount = debt.balanceAmount;
    const updatedDebt = await tx.customerDebt.update({
      where: { id: debt.id },
      data: {
        balanceAmount: new Prisma.Decimal(0),
        status: DebtStatus.WRITTEN_OFF,
      },
    });

    // Ledger the write-off so DebtPayment totals reconcile with debt reductions
    // (distinct from cash collection, which uses method CASH).
    await tx.debtPayment.create({
      data: {
        debtId: debt.id,
        collectedById: actor.id,
        method: PaymentMethod.WRITE_OFF,
        amount: writtenOffAmount,
      },
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: debt.invoiceId },
      data: {
        paidAmount: { increment: writtenOffAmount },
        debtAmount: { decrement: writtenOffAmount },
      },
    });

    await logAction(
      actor.id,
      "WRITE_OFF_DEBT",
      "CustomerDebt",
      debt.id,
      debtBefore,
      auditSnapshot(updatedDebt),
      { tx },
    );
    await logAction(
      actor.id,
      "WRITE_OFF_DEBT",
      "Invoice",
      debt.invoiceId,
      invoiceBefore,
      auditSnapshot(updatedInvoice),
      { tx },
    );
  });

  revalidatePath("/manager");
  revalidatePath("/manager/dashboard");
  revalidatePath("/finance/reconciliation-overview");
}

export async function approveReconciliationDiscrepancy(formData: FormData) {
  const reconciliationId = text(formData, "reconciliationId");
  const reason = text(formData, "reason");
  if (!reconciliationId || reason.length < 5) {
    throw new Error("Reconciliation and an approval reason of at least 5 characters are required.");
  }

  const { user: actor } = await requirePermission(Permissions.Finance_Update);
  const approvalRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.MANAGER]);
  if (!approvalRoles.has(actor.role)) {
    throw new Error("Only a management account can approve reconciliation discrepancies.");
  }
  const scope = await getBranchScope();
  await prisma.$transaction(async (tx) => {
    // Approval posts inventory, so serialize it to prevent a double post.
    await tx.$queryRaw<Array<{ lock_acquired: number }>>`
      SELECT 1::int AS lock_acquired
      FROM (SELECT pg_advisory_xact_lock(hashtext('reconciliation-approval'), hashtext(${reconciliationId}))) AS acquired
    `;
    const reconciliation = await tx.dailyReconciliation.findUniqueOrThrow({
      where: { id: reconciliationId },
      include: { items: true },
    });
    requireBranchAccess(scope, reconciliation.branchId);
    if (reconciliation.status !== ReconciliationStatus.DISCREPANCY_PENDING) {
      throw new Error("This reconciliation is not awaiting discrepancy approval.");
    }

    for (const item of reconciliation.items) {
      await tx.inventoryBalance.update({
        where: {
          branchId_productId: {
            branchId: reconciliation.branchId,
            productId: item.productId,
          },
        },
        data: {
          fullCount: { increment: item.eveningReturnedFull },
          emptyCount: { increment: item.eveningReturnedEmpty },
        },
      });
      if (item.eveningReturnedFull > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: reconciliation.branchId,
            productId: item.productId,
            reconciliationId,
            type: CylinderMovementType.DAILY_RETURN_FULL,
            fullDelta: item.eveningReturnedFull,
            note: `Approved discrepancy: ${reason}`,
          },
        });
      }
      if (item.eveningReturnedEmpty > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: reconciliation.branchId,
            productId: item.productId,
            reconciliationId,
            type: CylinderMovementType.DAILY_RETURN_EMPTY,
            emptyDelta: item.eveningReturnedEmpty,
            note: `Approved discrepancy: ${reason}`,
          },
        });
      }
    }

    const updated = await tx.dailyReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: ReconciliationStatus.EVENING_RECONCILED,
        eveningReconciledAt: new Date(),
        discrepancyApprovedById: actor.id,
        discrepancyApprovedAt: new Date(),
        discrepancyReason: reason,
      },
    });
    await logAction(
      actor.id,
      "APPROVE_RECONCILIATION_DISCREPANCY",
      "DailyReconciliation",
      reconciliationId,
      auditSnapshot(reconciliation),
      auditSnapshot(updated),
      { tx },
    );
  });

  revalidatePath("/finance/reconciliation-overview");
  revalidatePath("/loader");
}
