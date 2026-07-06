"use server";

import { CylinderMovementType, DebtStatus, InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildInvoiceSerial } from "@/lib/invoice";
import { getCurrentUser } from "@/lib/session";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function moneyValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Prisma.Decimal(value) : new Prisma.Decimal(0);
}

function decimalValue(formData: FormData, key: string, fallback: Prisma.Decimal) {
  const value = text(formData, key);
  return value ? new Prisma.Decimal(value) : fallback;
}

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decimalMax(value: Prisma.Decimal, floor: Prisma.Decimal) {
  return value.greaterThan(floor) ? value : floor;
}

async function storeUpload(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const publicDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, fileName), bytes);
  return `/uploads/${folder}/${fileName}`;
}

export async function createOrder(formData: FormData) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "SALESMAN" || !currentUser.branchId) {
      throw new Error("Salesman session is required.");
    }

    const branch = currentUser.branch;
    const branchId = currentUser.branchId;
    const customerId = text(formData, "customerId");
    const customerName = text(formData, "customerName");
    const customerPhone = text(formData, "customerPhone");
    const customerAddress = text(formData, "customerAddress");
    const customerVatNumber = text(formData, "customerVatNumber");
    const invoiceSerial = text(formData, "invoiceSerial") || buildInvoiceSerial();
    const currency = text(formData, "currency") || branch?.defaultCurrency || "OMR";
    const branchTaxRate = branch?.defaultTaxRate && branch.defaultTaxRate.greaterThan(0)
      ? branch.defaultTaxRate
      : new Prisma.Decimal("5.0000");
    const taxRate = decimalValue(formData, "taxRate", branchTaxRate);
    const applyDebtCollection = text(formData, "applyDebtCollection") === "true";
    const requestedDebtCollection = moneyValue(formData, "debtCollectionAmount");

    const rowProductIds = formData.getAll("rowProductId").filter((value): value is string => typeof value === "string");
    const rowFulls = formData.getAll("rowFull").filter((value): value is string => typeof value === "string");
    const rowEmpties = formData.getAll("rowEmpty").filter((value): value is string => typeof value === "string");
    const rowPrices = formData.getAll("rowPrice").filter((value): value is string => typeof value === "string");

    if (!customerId && !customerName && !customerPhone) {
      throw new Error("Enter a customer name or phone number.");
    }

    const invoice = await prisma.$transaction(async (tx) => {
    const branchRow = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
    const salesman = await tx.user.findUniqueOrThrow({ where: { id: currentUser.id } });

    const existingCustomer = customerId
      ? await tx.customer.findFirst({
          where: {
            id: customerId,
            branchId: branchRow.id,
          },
        })
      : null;

    const customer =
      existingCustomer ??
      (await tx.customer.findFirst({
        where: {
          branchId: branchRow.id,
          OR: [
            customerPhone ? { phone: customerPhone } : undefined,
            customerName ? { name: { equals: customerName, mode: "insensitive" } } : undefined,
          ].filter(Boolean) as Prisma.CustomerWhereInput[],
        },
      })) ??
      (await tx.customer.create({
        data: {
          branchId: branchRow.id,
          name: customerName || customerPhone,
          phone: customerPhone || null,
          address: customerAddress || null,
          vatNumber: customerVatNumber || null,
          phoneCode: branchRow.defaultPhoneCode,
          taxRate,
        },
      }));

    const lines = [];

    for (let index = 0; index < rowProductIds.length; index += 1) {
      const productId = rowProductIds[index];
      const fullQty = Number.parseInt(rowFulls[index] || "0", 10) || 0;
      const emptyQty = Number.parseInt(rowEmpties[index] || "0", 10) || 0;
      const unitPrice = new Prisma.Decimal(rowPrices[index] || "0");

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
            where: { branchId: branchRow.id, endsAt: null },
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
    const taxAmount = subtotal.mul(new Prisma.Decimal("0.05"));
    const totalAmount = subtotal.add(taxAmount);
    console.log("invoice.calculate", {
      subtotal: subtotal.toFixed(3),
      vatAmount: taxAmount.toFixed(3),
      total: totalAmount.toFixed(3),
    });
    const cashAmount = moneyValue(formData, "cashAmount");
    const checkAmount = moneyValue(formData, "checkAmount");
    const transferAmount = moneyValue(formData, "bankTransferAmount");
    const paidAmount = cashAmount.add(checkAmount).add(transferAmount);
    const debtCollectionAmount = applyDebtCollection ? requestedDebtCollection : new Prisma.Decimal(0);

    const debtAmount = decimalMax(totalAmount.sub(paidAmount), new Prisma.Decimal(0));

    const createdInvoice = await tx.invoice.create({
      data: {
        invoiceNumber: invoiceSerial,
        invoiceSerial,
        branchId: branchRow.id,
        customerId: customer.id,
        salesmanId: salesman.id,
        status: InvoiceStatus.ISSUED,
        currency,
        taxRate,
        subtotalAmount: subtotal,
        taxAmount,
        totalAmount,
        paidAmount,
        debtAmount,
        debtCollectionAmount,
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

    const transferAttachment = await storeUpload(formData.get("transferReceipt"), "transfers");
    const checkAttachment = await storeUpload(formData.get("checkReceipt"), "checks");
    const checkDate = parseDate(text(formData, "checkDate"));
    const checkNumber = text(formData, "checkNumber");
    const transferReference = text(formData, "transferReference");

    if (cashAmount.greaterThan(0)) {
      await tx.payment.create({
        data: {
          invoiceId: createdInvoice.id,
          method: PaymentMethod.CASH,
          amount: cashAmount,
        },
      });
    }

    if (checkAmount.greaterThan(0)) {
      await tx.payment.create({
        data: {
          invoiceId: createdInvoice.id,
          method: PaymentMethod.CHECK,
          amount: checkAmount,
          referenceNumber: checkNumber || null,
          attachmentUrl: checkAttachment,
          checkDate,
        },
      });
    }

    if (transferAmount.greaterThan(0)) {
      await tx.payment.create({
        data: {
          invoiceId: createdInvoice.id,
          method: PaymentMethod.BANK_TRANSFER,
          amount: transferAmount,
          referenceNumber: transferReference || null,
          attachmentUrl: transferAttachment,
        },
      });
    }

    if (debtCollectionAmount.greaterThan(0)) {
      let remainingCollection = debtCollectionAmount;
      let appliedCollection = new Prisma.Decimal(0);

      const openDebts = await tx.customerDebt.findMany({
        where: {
          customerId: customer.id,
          balanceAmount: { gt: 0 },
        },
        orderBy: { createdAt: "asc" },
      });

      for (const debt of openDebts) {
        if (remainingCollection.lessThanOrEqualTo(0)) {
          break;
        }

        const appliedToDebt = remainingCollection.greaterThan(debt.balanceAmount) ? debt.balanceAmount : remainingCollection;
        const newBalance = debt.balanceAmount.sub(appliedToDebt);

        await tx.debtPayment.create({
          data: {
            debtId: debt.id,
            collectedById: salesman.id,
            method: PaymentMethod.CASH,
            amount: appliedToDebt,
          },
        });

        await tx.customerDebt.update({
          where: { id: debt.id },
          data: {
            balanceAmount: newBalance,
            status: newBalance.equals(0) ? DebtStatus.PAID : DebtStatus.PARTIALLY_PAID,
          },
        });

        remainingCollection = remainingCollection.sub(appliedToDebt);
        appliedCollection = appliedCollection.add(appliedToDebt);
      }

      if (appliedCollection.greaterThan(0)) {
        await tx.invoice.update({
          where: { id: createdInvoice.id },
          data: {
            debtCollectionAmount: appliedCollection,
          },
        });
      }
    }

    if (debtAmount.greaterThan(0)) {
      await tx.customerDebt.create({
        data: {
          customerId: customer.id,
          invoiceId: createdInvoice.id,
          originalAmount: debtAmount,
          balanceAmount: debtAmount,
          status: paidAmount.greaterThan(0) ? DebtStatus.PARTIALLY_PAID : DebtStatus.OPEN,
        },
      });
    }

    for (const line of lines) {
      if (line.fullQty > 0) {
        await tx.cylinderMovement.create({
          data: {
            branchId: branchRow.id,
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
            branchId: branchRow.id,
            productId: line.productId,
            invoiceId: createdInvoice.id,
            type: CylinderMovementType.CUSTOMER_EMPTY_RETURNED,
            emptyDelta: line.emptyQty,
          },
        });
      }

      await tx.inventoryBalance.upsert({
        where: { branchId_productId: { branchId: branchRow.id, productId: line.productId } },
        update: {
          fullCount: { decrement: line.fullQty },
          emptyCount: { increment: line.emptyQty },
        },
        create: {
          branchId: branchRow.id,
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
    revalidatePath("/salesman/history");
    redirect(`/salesman/receipt/${invoice.id}`);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to save invoice.";
    redirect(`/salesman/new-order?error=${encodeURIComponent(message)}`);
  }
}
