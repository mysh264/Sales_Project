"use server";

import { CylinderMovementType, InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function intValue(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key) || "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function moneyValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Prisma.Decimal(value) : new Prisma.Decimal(0);
}

function decimalMax(value: Prisma.Decimal, floor: Prisma.Decimal) {
  return value.greaterThan(floor) ? value : floor;
}

export async function createOrder(formData: FormData) {
  const currentUser = await getCurrentUser();
  const customerName = text(formData, "customerName");
  const customerPhone = text(formData, "customerPhone");
  const productIds = formData.getAll("productId").filter((value): value is string => typeof value === "string");

  if (!currentUser || currentUser.role !== "SALESMAN" || !currentUser.branchId) {
    throw new Error("Salesman session is required.");
  }

  if (!customerName && !customerPhone) {
    throw new Error("Enter a customer name or phone number.");
  }

  const branchId = currentUser.branchId;

  const invoice = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
    const salesman = await tx.user.findUniqueOrThrow({ where: { id: currentUser.id } });

    const customer =
      (await tx.customer.findFirst({
        where: {
          branchId: branch.id,
          OR: [
            customerPhone ? { phone: customerPhone } : undefined,
            customerName ? { name: { equals: customerName, mode: "insensitive" } } : undefined,
          ].filter(Boolean) as Prisma.CustomerWhereInput[],
        },
      })) ??
      (await tx.customer.create({
        data: {
          branchId: branch.id,
          name: customerName || customerPhone,
          phone: customerPhone || null,
          phoneCode: branch.defaultPhoneCode,
          taxRate: branch.defaultTaxRate,
        },
      }));

    const lines = [];

    for (const productId of productIds) {
      const fullQty = intValue(formData, `product-${productId}-full`);
      const emptyQty = intValue(formData, `product-${productId}-empty`);
      const unitPrice = moneyValue(formData, `product-${productId}-price`);

      if (fullQty === 0 && emptyQty === 0) {
        continue;
      }

      if (fullQty > 0 && unitPrice.lessThanOrEqualTo(0)) {
        throw new Error("Enter a sale price for every delivered cylinder.");
      }

      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: {
          priceRules: {
            where: { branchId: branch.id, endsAt: null },
            orderBy: { startsAt: "desc" },
            take: 1,
          },
        },
      });

      const priceRule = product.priceRules[0];
      if (!priceRule) {
        throw new Error(`No price rule is configured for ${product.name}.`);
      }

      if (fullQty > 0 && (unitPrice.lessThan(priceRule.minPrice) || unitPrice.greaterThan(priceRule.maxPrice))) {
        throw new Error(`${product.name} price must be between ${priceRule.minPrice} and ${priceRule.maxPrice}.`);
      }

      lines.push({
        productId,
        fullQty,
        emptyQty,
        unitPrice,
        lineSubtotal: unitPrice.mul(fullQty),
      });
    }

    if (lines.length === 0) {
      throw new Error("Enter at least one cylinder quantity.");
    }

    const subtotal = lines.reduce((sum, line) => sum.add(line.lineSubtotal), new Prisma.Decimal(0));
    const taxAmount = subtotal.mul(branch.defaultTaxRate);
    const totalAmount = subtotal.add(taxAmount);
    const cashAmount = moneyValue(formData, "cashAmount");
    const checkAmount = moneyValue(formData, "checkAmount");
    const transferAmount = moneyValue(formData, "bankTransferAmount");
    const paidAmount = cashAmount.add(checkAmount).add(transferAmount);

    if (paidAmount.greaterThan(totalAmount)) {
      throw new Error("Payment cannot be higher than the invoice total.");
    }

    const debtAmount = decimalMax(totalAmount.sub(paidAmount), new Prisma.Decimal(0));

    const createdInvoice = await tx.invoice.create({
      data: {
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        branchId: branch.id,
        customerId: customer.id,
        salesmanId: salesman.id,
        status: InvoiceStatus.ISSUED,
        currency: branch.defaultCurrency,
        taxRate: branch.defaultTaxRate,
        subtotalAmount: subtotal,
        taxAmount,
        totalAmount,
        paidAmount,
        debtAmount,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            fullCylindersDelivered: line.fullQty,
            emptyCylindersReturned: line.emptyQty,
            unitPrice: line.unitPrice,
            lineSubtotal: line.lineSubtotal,
          })),
        },
      },
    });

    const paymentRows = [
      cashAmount.greaterThan(0)
        ? { invoiceId: createdInvoice.id, method: PaymentMethod.CASH, amount: cashAmount }
        : null,
      checkAmount.greaterThan(0)
        ? {
            invoiceId: createdInvoice.id,
            method: PaymentMethod.CHECK,
            amount: checkAmount,
            referenceNumber: text(formData, "checkReference") || null,
          }
        : null,
      transferAmount.greaterThan(0)
        ? {
            invoiceId: createdInvoice.id,
            method: PaymentMethod.BANK_TRANSFER,
            amount: transferAmount,
            referenceNumber: text(formData, "transferReference") || null,
          }
        : null,
    ].filter(Boolean) as Prisma.PaymentCreateManyInput[];

    if (paymentRows.length > 0) {
      await tx.payment.createMany({ data: paymentRows });
    }

    if (debtAmount.greaterThan(0)) {
      await tx.customerDebt.create({
        data: {
          customerId: customer.id,
          invoiceId: createdInvoice.id,
          originalAmount: debtAmount,
          balanceAmount: debtAmount,
        },
      });
    }

    for (const line of lines) {
      if (line.fullQty > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: branch.id,
            productId: line.productId,
            invoiceId: createdInvoice.id,
            type: CylinderMovementType.SALE_FULL_DELIVERED,
            fullDelta: -line.fullQty,
          },
        });
      }

      if (line.emptyQty > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: branch.id,
            productId: line.productId,
            invoiceId: createdInvoice.id,
            type: CylinderMovementType.CUSTOMER_EMPTY_RETURNED,
            emptyDelta: line.emptyQty,
          },
        });
      }

      await tx.inventoryBalance.upsert({
        where: { branchId_productId: { branchId: branch.id, productId: line.productId } },
        update: {
          fullCount: { decrement: line.fullQty },
          emptyCount: { increment: line.emptyQty },
        },
        create: {
          branchId: branch.id,
          productId: line.productId,
          fullCount: -line.fullQty,
          emptyCount: line.emptyQty,
        },
      });
    }

    return createdInvoice;
  });

  revalidatePath("/salesman");
  revalidatePath("/salesman/new-order");
  redirect(`/salesman/receipt/${invoice.id}`);
}
