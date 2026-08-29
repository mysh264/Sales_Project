"use server";

import { CylinderMovementType, DebtStatus, InvoiceStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditSnapshot, logAction } from "@/lib/audit";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { prisma } from "@/lib/prisma";
import { buildInvoiceSerial } from "@/lib/invoice";
import { getCurrentUser } from "@/lib/session";
import { deletePrivateUpload, storePrivateUpload } from "@/lib/uploads";
import { businessDate, businessDayRange } from "@/lib/business-date";
import { logEvent } from "@/lib/logger";
import { moneyToFixed } from "@/lib/money";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function moneyValue(formData: FormData, key: string) {
  const value = text(formData, key);
  const amount = value ? new Prisma.Decimal(value) : new Prisma.Decimal(0);
  if (amount.isNegative()) {
    throw new Error("Payment and collection amounts cannot be negative.");
  }
  return amount;
}

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nonNegativeInteger(value: string, label: string) {
  if (!/^\d+$/.test(value || "0")) {
    throw new Error(`${label} must be a whole number of zero or more.`);
  }
  const parsed = Number(value || "0");
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} is too large.`);
  }
  return parsed;
}

function decimalMax(value: Prisma.Decimal, floor: Prisma.Decimal) {
  return value.greaterThan(floor) ? value : floor;
}

function percentRate(value: Prisma.Decimal) {
  return value.div(100);
}

export async function createOrder(formData: FormData) {
  const storedUploadUrls: string[] = [];
  try {
    const currentUser = await getCurrentUser();

    await requirePermission(Permissions.Sales_Create);

    if (!currentUser || !currentUser.branchId) {
      throw new Error("Salesman session is required.");
    }

    const branch = currentUser.branch;
    const branchId = currentUser.branchId;
    const customerId = text(formData, "customerId");
    const customerName = text(formData, "customerName");
    const customerPhone = text(formData, "customerPhone");
    const customerAddress = text(formData, "customerAddress");
    const customerVatNumber = text(formData, "customerVatNumber");
    const autoInvoiceSerial = buildInvoiceSerial();
    // invoiceSerial is the server-generated unique key; the salesman may also provide a
    // human-facing invoice number via the "Invoice Serial" field, which we store as invoiceNumber.
    const invoiceSerial = text(formData, "invoiceSerial") || autoInvoiceSerial;
    const submittedInvoiceNumber = text(formData, "manualSerial").trim();
    const invoiceNumber = submittedInvoiceNumber || invoiceSerial;
    const submissionToken = text(formData, "submissionToken");
    const now = new Date();
    // Invoices are recorded for the current Oman business day only. Backdating to a previous
    // day is intentionally disallowed: a morning load is only ever recorded for "today", so a
    // backdated invoice could never be reconciled against the correct day's load and would be
    // silently inconsistent. (See report item B5.)
    const invoiceDate = now;

    // Currency: honour the submitted value only when it is a known currency, otherwise fall
    // back to the branch default. This keeps the invoice_currency in sync with what the user saw.
    const ALLOWED_CURRENCIES = new Set(["OMR", "USD", "AED"]);
    const submittedCurrency = text(formData, "currency").toUpperCase();
    const currency = ALLOWED_CURRENCIES.has(submittedCurrency) ? submittedCurrency : (branch?.defaultCurrency || "OMR");

    // VAT rate: the form may override the branch default within a sane band (0–25%).
    const branchTaxRate = branch?.defaultTaxRate && branch.defaultTaxRate.greaterThan(0)
      ? branch.defaultTaxRate
      : new Prisma.Decimal("5.0000");
    const submittedTaxRate = moneyValue(formData, "taxRate");
    const taxRate =
      submittedTaxRate.greaterThanOrEqualTo(0) && submittedTaxRate.lessThanOrEqualTo(25)
        ? submittedTaxRate
        : branchTaxRate;
    const applyDebtCollection = text(formData, "applyDebtCollection") === "true";
    const requestedDebtCollection = moneyValue(formData, "debtCollectionAmount");

    const rowProductIds = formData.getAll("rowProductId").filter((value): value is string => typeof value === "string");
    const rowFulls = formData.getAll("rowFull").filter((value): value is string => typeof value === "string");
    const rowEmpties = formData.getAll("rowEmpty").filter((value): value is string => typeof value === "string");
    const rowPrices = formData.getAll("rowPrice").filter((value): value is string => typeof value === "string");
    if (
      rowProductIds.length !== rowFulls.length ||
      rowProductIds.length !== rowEmpties.length ||
      rowProductIds.length !== rowPrices.length
    ) {
      throw new Error("Invoice line data is incomplete.");
    }

    if (!customerId && !customerName && !customerPhone) {
      throw new Error("Enter a customer name or phone number.");
    }

    if (!submissionToken) {
      throw new Error("Missing submission token.");
    }

    const duplicateSubmission = await prisma.invoice.findUnique({
      where: { submissionToken },
      select: { id: true },
    });

    if (duplicateSubmission) {
      throw new Error("This invoice was already submitted. Please wait a moment.");
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const branchRow = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
      const salesman = await tx.user.findUniqueOrThrow({ where: { id: currentUser.id } });

    const customerScope = { branchId: branchRow.id };

    const existingCustomer = customerId
      ? await tx.customer.findFirst({
          where: {
            id: customerId,
            ...customerScope,
          },
        })
      : null;

    const customer =
      existingCustomer ??
      (await tx.customer.findFirst({
        where: {
          ...customerScope,
          ...(customerPhone ? { phone: customerPhone } : { id: "__new_customer__" }),
        },
      })) ??
      (await tx.customer.create({
        data: {
          branchId: branchRow.id,
          customerNumber: `CUS-${randomUUID()}`,
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
      const fullQty = nonNegativeInteger(rowFulls[index] || "0", "Delivered quantity");
      const emptyQty = nonNegativeInteger(rowEmpties[index] || "0", "Returned quantity");
      const unitPrice = new Prisma.Decimal(rowPrices[index] || "0");
      if (unitPrice.isNegative()) {
        throw new Error("Sale price cannot be negative.");
      }

      if (fullQty === 0 && emptyQty === 0) {
        continue;
      }

      if (fullQty > 0 && unitPrice.lessThanOrEqualTo(0)) {
        throw new Error("Enter a sale price for every delivered cylinder.");
      }

      const product = await tx.product.findFirstOrThrow({
        where: { id: productId, isActive: true, OR: [{ branchId: null }, { branchId: branchRow.id }] },
        include: {
          priceRules: {
            where: { endsAt: null },
            orderBy: { startsAt: "desc" },
          },
        },
      });

      const priceRule = product.priceRules.find((rule) => rule.branchId === branchRow.id && rule.currency === currency);
      if (!priceRule) {
        throw new Error(`No active ${currency} price rule is configured for ${product.name} in ${branchRow.name}.`);
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

    const routeDate = businessDate(invoiceDate);
    const { start: routeStart, end: routeEnd } = businessDayRange(invoiceDate);
    await tx.$queryRaw<Array<{ lock_acquired: number }>>`
      SELECT 1::int AS lock_acquired
      FROM (SELECT pg_advisory_xact_lock(hashtext(${salesman.id}), hashtext(${routeDate.toISOString()}))) AS acquired
    `;
    const reconciliation = await tx.dailyReconciliation.findUnique({
      where: {
        salesmanId_reconciliationDate: {
          salesmanId: salesman.id,
          reconciliationDate: routeDate,
        },
      },
      include: { items: true },
    });
    if (!reconciliation || reconciliation.status !== "MORNING_RECORDED") {
      throw new Error("A morning load must be recorded before creating sales.");
    }
    const loadedByProduct = new Map(reconciliation.items.map((item) => [item.productId, item.morningFull]));
    const existingSales = await tx.invoiceItem.groupBy({
      by: ["productId"],
      where: {
        invoice: {
          salesmanId: salesman.id,
          status: InvoiceStatus.ISSUED,
          createdAt: { gte: routeStart, lt: routeEnd },
        },
      },
      _sum: { fullCylindersDelivered: true },
    });
    const soldByProduct = new Map(existingSales.map((row) => [row.productId, row._sum.fullCylindersDelivered ?? 0]));
    for (const line of lines) {
      if ((soldByProduct.get(line.productId) ?? 0) + line.fullQty > (loadedByProduct.get(line.productId) ?? 0)) {
        throw new Error("Sale quantity exceeds this salesman's remaining morning load.");
      }
    }

    const subtotal = lines.reduce((sum, line) => sum.add(line.lineSubtotal), new Prisma.Decimal(0));
    const taxAmount = subtotal.mul(percentRate(taxRate));
    const totalAmount = subtotal.add(taxAmount);
    logEvent("info", "invoice.calculate", {
      subtotal: moneyToFixed(subtotal),
      vatAmount: moneyToFixed(taxAmount),
      total: moneyToFixed(totalAmount),
    });
    const cashAmount = moneyValue(formData, "cashAmount");
    const checkAmount = moneyValue(formData, "checkAmount");
    const transferAmount = moneyValue(formData, "bankTransferAmount");
    const externalPaidAmount = cashAmount.add(checkAmount).add(transferAmount);
    const debtCollectionAmount = applyDebtCollection ? requestedDebtCollection : new Prisma.Decimal(0);
    if (checkAmount.greaterThan(0) && !text(formData, "checkNumber")) {
      throw new Error("Cheque number is required for cheque payments.");
    }
    if (transferAmount.greaterThan(0) && !text(formData, "transferReference")) {
      throw new Error("Transfer reference is required for bank transfers.");
    }

    // Serialize credit consumption for this customer so two simultaneous invoices
    // cannot both spend the same balance.
    await tx.$queryRaw<Array<{ lock_acquired: number }>>`
      SELECT 1::int AS lock_acquired
      FROM (SELECT pg_advisory_xact_lock(hashtext('customer-credit'), hashtext(${customer.id}))) AS acquired
    `;
    const lockedCustomer = await tx.customer.findUniqueOrThrow({ where: { id: customer.id } });
    const amountDueAfterExternalPayment = decimalMax(totalAmount.sub(externalPaidAmount), new Prisma.Decimal(0));
    const creditApplied = lockedCustomer.creditBalance.greaterThan(amountDueAfterExternalPayment)
      ? amountDueAfterExternalPayment
      : lockedCustomer.creditBalance;
    const rawPaidAmount = externalPaidAmount.add(creditApplied);
    // An overpayment (cash/cheque/transfer exceeding the invoice total) must not make
    // paidAmount exceed totalAmount: the invoice is fully paid and the excess is held as
    // customer credit (see customerCredit below). This keeps "paid vs total" reports honest.
    const paidAmount = rawPaidAmount.greaterThan(totalAmount) ? totalAmount : rawPaidAmount;
    const debtAmount = decimalMax(totalAmount.sub(paidAmount), new Prisma.Decimal(0));
    const customerCredit = decimalMax(externalPaidAmount.sub(totalAmount), new Prisma.Decimal(0));

    const currentDebt = await tx.customerDebt.aggregate({
      where: {
        customerId: customer.id,
        status: { in: [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID] },
      },
      _sum: { balanceAmount: true },
    });
    const outstandingDebt = currentDebt._sum.balanceAmount ?? new Prisma.Decimal(0);
    const projectedDebt = outstandingDebt.add(debtAmount);

    if (lockedCustomer.creditLimit && projectedDebt.greaterThan(lockedCustomer.creditLimit)) {
      throw new Error("Credit Limit Exceeded");
    }

    const createdInvoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        invoiceSerial,
        submissionToken,
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
        customerCredit,
        creditApplied,
        createdAt: invoiceDate,
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
    await tx.customer.update({
      where: { id: customer.id },
      data: {
        creditBalance: lockedCustomer.creditBalance.sub(creditApplied).add(customerCredit),
      },
    });

    const transferAttachment = await storePrivateUpload(formData.get("transferReceipt"), "transfers");
    const checkAttachment = await storePrivateUpload(formData.get("checkReceipt"), "checks");
    if (transferAttachment) storedUploadUrls.push(transferAttachment);
    if (checkAttachment) storedUploadUrls.push(checkAttachment);
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

        // Keep the source invoice's paid/debt totals consistent (mirrors manager.collectDebt).
        if (debt.invoiceId) {
          await tx.invoice.update({
            where: { id: debt.invoiceId },
            data: {
              paidAmount: { increment: appliedToDebt },
              debtAmount: { decrement: appliedToDebt },
            },
          });
        }

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

    }

    const finalInvoice = await tx.invoice.findUniqueOrThrow({
      where: { id: createdInvoice.id },
      include: {
        items: true,
        payments: true,
        customerDebts: true,
      },
    });

    await logAction(
      salesman.id,
      "CREATE_INVOICE",
      "Invoice",
      createdInvoice.id,
      null,
      auditSnapshot(finalInvoice),
      { tx },
    );

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
    await Promise.all(storedUploadUrls.map((url) => deletePrivateUpload(url)));

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("submissionToken")
    ) {
      redirect(`/salesman/new-order?error=${encodeURIComponent("This invoice was already submitted. Please wait a moment.")}`);
    }

    const message = error instanceof Error ? error.message : "Unable to save invoice.";
    redirect(`/salesman/new-order?error=${encodeURIComponent(message)}`);
  }
}
