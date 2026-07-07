"use server";

import { DebtStatus, PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Prisma.Decimal(value) : new Prisma.Decimal(0);
}

function paymentMethod(value: string) {
  if (value in PaymentMethod) {
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

  if (minPrice.lessThan(0) || maxPrice.lessThan(0) || minPrice.greaterThan(maxPrice)) {
    throw new Error("Price limits are invalid.");
  }

  await requirePermission(Permissions.Products_Update);

  await prisma.$transaction(async (tx) => {
    let updatedRule;
    let previousRule = null;

    if (ruleId) {
      previousRule = await tx.productPriceRule.findUniqueOrThrow({ where: { id: ruleId } });
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

      previousRule = await tx.productPriceRule.findFirst({
        where: {
          branchId,
          productId,
          endsAt: null,
        },
        orderBy: { startsAt: "desc" },
      });

      if (previousRule) {
        await tx.productPriceRule.update({
          where: { id: previousRule.id },
          data: { endsAt: new Date() },
        });
      }

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
      branchId || updatedRule.branchId,
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

  await requirePermission(Permissions.Finance_Update);

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

    if (debt.balanceAmount.lessThanOrEqualTo(0)) {
      throw new Error("Debt is already paid.");
    }

    if (amount.greaterThan(debt.balanceAmount)) {
      throw new Error("Collection amount cannot exceed debt balance.");
    }

    const collector = await tx.user.findFirst({
      where: { branchId: debt.customer.branchId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (!collector) {
      throw new Error("No active user exists to record this debt collection.");
    }

    const newBalance = debt.balanceAmount.sub(amount);
    const newStatus = newBalance.equals(0) ? DebtStatus.PAID : DebtStatus.PARTIALLY_PAID;

    await tx.debtPayment.create({
      data: {
        debtId: debt.id,
        collectedById: collector.id,
        method,
        amount,
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
      collector.id,
      "COLLECT_DEBT",
      "CustomerDebt",
      debt.id,
      debtBefore,
      auditSnapshot(updatedDebt),
      { tx },
    );

    await logAction(
      collector.id,
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
