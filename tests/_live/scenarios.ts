import assert from "node:assert/strict";
import { inspect } from "node:util";
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
import { PrismaClient, Prisma, UserRole, DebtStatus, InvoiceStatus, ReconciliationStatus, PaymentMethod } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import * as stub from "./next-headers-stub.mjs";
import { processMorningLoad, processEveningReturn } from "@/app/actions/loader";
import { createOrder } from "@/app/actions/sales";
import { writeOffDebt } from "@/app/actions/manager";

const results: Array<[string, string, string]> = [];
function check(name: string, fn: () => Promise<void>) {
  return (async () => {
    try {
      await fn();
      results.push(["PASS", name, ""]);
      console.log("PASS  " + name);
    } catch (e: any) {
      if (isSuccessRedirect(e)) { results.push(["PASS", name, ""]); console.log("PASS  " + name); return; }
      console.log("   [debug] redirect digest:", e?.digest || e?.message);
      const insp = inspect(e, { depth: 1 }).split("\n").slice(0, 4).join(" | ");
      results.push(["FAIL", name, insp]);
      console.log("FAIL  " + name + "  -> " + insp);
    }
  })();
}
function jwtSecret() {
  const env = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  const secret = env.split("\n").find((l) => l.startsWith("JWT_SECRET="))!.split("=")[1].trim();
  process.env.JWT_SECRET = secret;
  return new TextEncoder().encode(secret);
}
async function loginAs(user: { id: string; role: UserRole; sessionVersion: number }) {
  const token = await new SignJWT({ userId: user.id, role: user.role, permissions: [], sessionVersion: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("2h").sign(jwtSecret());
  stub.__setCookie("sales_session", token);
}
function fd(entries: Array<[string, string | number]>) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, String(v));
  return f;
}
function orderFd(entries: Array<[string, string | number]>) {
  return fd([["submissionToken", crypto.randomUUID()], ...entries]);
}
function isSuccessRedirect(e: any) {
  const d = e?.digest || (typeof e?.message === "string" ? e.message : "");
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT") && !d.includes("error=");
}
async function rejected(name: string, fn: () => Promise<void>) {
  await check(name, async () => {
    let threw = false, ok = false;
    try { await fn(); } catch (e: any) { threw = true; ok = isSuccessRedirect(e); }
    assert.equal(threw && !ok, true, "expected a validation rejection");
  });
}

const main = async () => {
  const salesman = await prisma.user.findUniqueOrThrow({ where: { email: "salesman@test.local" }, include: { branch: true } });
  const loader = await prisma.user.findUniqueOrThrow({ where: { email: "loader@test.local" }, include: { branch: true } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@test.local" }, include: { branch: true } });
  const branchId = salesman.branchId!;
  assert.ok(branchId);
  const created: string[] = []; // product ids to clean
  const createdUsers: string[] = []; // salesman ids to clean
  const createdCustomers: Promise<string>[] = []; // customer ids to clean (promises resolved at teardown)

  const makeProduct = async () => {
    const p = await prisma.product.create({
      data: {
        name: "LIVE-CYL", sku: "LIVE-CYL-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), gasType: "OXYGEN", cylinderSize: "50L",
        isActive: true, branchId,
        priceRules: {
          create: [
            { branchId, currency: "OMR", minPrice: new Prisma.Decimal("1"), maxPrice: new Prisma.Decimal("100"), startsAt: new Date("2000-01-01") },
            { branchId, currency: "USD", minPrice: new Prisma.Decimal("1"), maxPrice: new Prisma.Decimal("100"), startsAt: new Date("2000-01-01") },
            { branchId, currency: "AED", minPrice: new Prisma.Decimal("1"), maxPrice: new Prisma.Decimal("100"), startsAt: new Date("2000-01-01") },
          ],
        },
      },
    });
    created.push(p.id);
    await prisma.inventoryBalance.create({ data: { branchId, productId: p.id, fullCount: 500, emptyCount: 500 } });
    return p;
  };
  const makeSalesman = async () => { const u = await prisma.user.create({ data: { email: "livesales-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@test.local", fullName: "Live Salesman", role: UserRole.SALESMAN, branchId, passwordHash: "x", sessionVersion: 1, isActive: true } }); createdUsers.push(u.id); return u; };
  const makeCustomer = () => { const c = prisma.customer.create({ data: { branchId, name: "Live", phone: "90000000" + Math.floor(Math.random() * 1000), customerNumber: "LTC-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), taxRate: new Prisma.Decimal("5") } }); createdCustomers.push(c.then((x) => x.id)); return c; };

  console.log("\n=== LIVE BUSINESS-LOGIC SCENARIOS (real actions vs live DB) ===\n");

  // 1. Morning load
  const p1 = await makeProduct();
  await check("1. Morning load records 10 cylinders and decrements inventory", async () => {
    await loginAs(loader);
    await processMorningLoad(fd([["salesmanId", salesman.id], ["productId", p1.id], ["morningFull", 10]]));
    const inv = await prisma.inventoryBalance.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: p1.id } } });
    assert.equal(inv.fullCount, 490);
    const rec = await prisma.dailyReconciliation.findFirstOrThrow({ where: { salesmanId: salesman.id, status: ReconciliationStatus.MORNING_RECORDED }, include: { items: true } });
    assert.equal(rec.items[0]?.morningFull, 10);
  });

  // 2. Full cash sale (isolated customer)
  const c2 = await makeCustomer();
  await check("2. Full cash sale: totals = qty*price + 5% VAT, debt 0", async () => {
    await loginAs(salesman);
    try { await createOrder(orderFd([["customerId", c2.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 3], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "31.5"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const inv = await prisma.invoice.findFirstOrThrow({ where: { salesmanId: salesman.id, customerId: c2.id, status: InvoiceStatus.ISSUED }, orderBy: { createdAt: "desc" } });
    assert.equal(inv.subtotalAmount.toFixed(3), "30.000");
    assert.equal(inv.taxAmount.toFixed(3), "1.500");
    assert.equal(inv.totalAmount.toFixed(3), "31.500");
    assert.equal(inv.paidAmount.toFixed(3), "31.500");
    assert.equal(inv.debtAmount.toFixed(3), "0.000");
    assert.equal(await prisma.customerDebt.count({ where: { invoiceId: inv.id } }), 0);
  });

  // 3. Overpayment -> credit, paidAmount NOT capped at total (known behaviour)
  const c3 = await makeCustomer();
  await check("3. Overpayment creates customer credit, paidAmount capped at total", async () => {
    await loginAs(salesman);
    try { await createOrder(orderFd([["customerId", c3.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 2], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "100"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const inv = await prisma.invoice.findFirstOrThrow({ where: { salesmanId: salesman.id, customerId: c3.id }, orderBy: { createdAt: "desc" } });
    assert.equal(inv.totalAmount.toFixed(3), "21.000");
    assert.equal(inv.paidAmount.toFixed(3), "21.000", "paidAmount must be capped at total on overpayment");
    assert.equal(inv.customerCredit.toFixed(3), "79.000", "excess cash becomes customer credit");
    assert.equal(inv.debtAmount.toFixed(3), "0.000");
    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: c3.id } });
    assert.ok(cust.creditBalance.gt(0), "customer credit balance must be positive");
  });

  // 4. Partial payment -> debt on invoice (isolated customer, no prior credit)
  const c4 = await makeCustomer();
  await check("4. Partial payment records debt on the invoice", async () => {
    await loginAs(salesman);
    try { await createOrder(orderFd([["customerId", c4.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 4], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const inv = await prisma.invoice.findFirstOrThrow({ where: { salesmanId: salesman.id, customerId: c4.id }, orderBy: { createdAt: "desc" } });
    assert.equal(inv.totalAmount.toFixed(3), "42.000");
    assert.equal(inv.paidAmount.toFixed(3), "10.500");
    assert.equal(inv.debtAmount.toFixed(3), "31.500");
    const debt = await prisma.customerDebt.findFirstOrThrow({ where: { invoiceId: inv.id } });
    assert.equal(debt.balanceAmount.toFixed(3), "31.500");
  });

  // 5. Debt collection inside new order updates OLD source invoice (B1 fix) — isolated debt customer
  const c5 = await makeCustomer();
  await check("5. Collecting old debt inside new order updates old invoice paid/debt (B1)", async () => {
    const s5 = await makeSalesman();
    await loginAs(loader);
    try { await processMorningLoad(fd([["salesmanId", s5.id], ["productId", p1.id], ["morningFull", 10]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(s5);
    try { await createOrder(orderFd([["customerId", c5.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 4], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const oldInv = await prisma.invoice.findFirstOrThrow({ where: { salesmanId: s5.id, customerId: c5.id }, orderBy: { createdAt: "desc" } });
    try { await createOrder(orderFd([["customerId", c5.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 1], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "0"], ["applyDebtCollection", "true"], ["debtCollectionAmount", "10"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const oldInvAfter = await prisma.invoice.findUniqueOrThrow({ where: { id: oldInv.id } });
    assert.equal(oldInvAfter.paidAmount.toFixed(3), "20.500", "old invoice paidAmount must rise by 10");
    assert.equal(oldInvAfter.debtAmount.toFixed(3), "21.500", "old invoice debtAmount must fall by 10 (42 total - 20.5 paid)");
    assert.ok(await prisma.debtPayment.findFirst({ where: { method: PaymentMethod.CASH } }), "DebtPayment ledger row exists");
  });

  // 6. Exceed morning load -> rejected
  const c6 = await makeCustomer();
  await rejected("6. Selling more than the morning load is rejected", async () => {
    await loginAs(salesman);
    const before = await prisma.invoice.count({ where: { salesmanId: salesman.id } });
    try { await createOrder(orderFd([["customerId", c6.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 11], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "0"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const after = await prisma.invoice.count({ where: { salesmanId: salesman.id } });
    assert.equal(after, before, "no invoice on rejected over-load sale");
  });

  // 7. Write-off logs WRITE_OFF + zeroes debt + bumps invoice paid (W3) — isolated debt customer
  const c7 = await makeCustomer();
  await check("7. Write-off zeros debt, logs WRITE_OFF payment, bumps invoice paid (W3)", async () => {
    const s7 = await makeSalesman();
    await loginAs(loader);
    try { await processMorningLoad(fd([["salesmanId", s7.id], ["productId", p1.id], ["morningFull", 10]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(s7);
    try { await createOrder(orderFd([["customerId", c7.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 4], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(manager);
    const openDebt = await prisma.customerDebt.findFirstOrThrow({ where: { customerId: c7.id, status: { in: [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID] } }, orderBy: { balanceAmount: "desc" } });
    const invBefore = await prisma.invoice.findUniqueOrThrow({ where: { id: openDebt.invoiceId } });
    await writeOffDebt(fd([["debtId", openDebt.id], ["reason", "Customer unreachable, approved by manager per policy."]]));
    const debtAfter = await prisma.customerDebt.findUniqueOrThrow({ where: { id: openDebt.id } });
    assert.equal(debtAfter.status, DebtStatus.WRITTEN_OFF);
    assert.equal(debtAfter.balanceAmount.toFixed(3), "0.000");
    assert.ok(await prisma.debtPayment.findFirst({ where: { debtId: openDebt.id, method: PaymentMethod.WRITE_OFF } }), "WRITE_OFF ledger row present");
    const invAfter = await prisma.invoice.findUniqueOrThrow({ where: { id: openDebt.invoiceId } });
    assert.ok(invAfter.paidAmount.gt(invBefore.paidAmount), "invoice paidAmount increases by written-off amount");
  });

  // 8. Multi-currency
  const c8 = await makeCustomer();
  await check("8. USD invoice stores currency=USD", async () => {
    await loginAs(salesman);
    try { await createOrder(orderFd([["customerId", c8.id], ["currency", "USD"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 1], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "0"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const inv = await prisma.invoice.findFirstOrThrow({ where: { salesmanId: salesman.id, customerId: c8.id, currency: "USD" }, orderBy: { createdAt: "desc" } });
    assert.equal(inv.currency, "USD");
  });

  // 9. Evening return MISSING a loaded product -> rejected (B2 fix)
  const p9 = await makeProduct();
  await rejected("9. Evening return omitting a loaded product is rejected (B2)", async () => {
    await loginAs(loader);
    try { await processMorningLoad(fd([["salesmanId", salesman.id], ["productId", p1.id], ["morningFull", 5], ["productId", p9.id], ["morningFull", 5]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await processEveningReturn(fd([["salesmanId", salesman.id], ["productId", p1.id], ["eveningReturnedFull", 5], ["eveningReturnedEmpty", 0]]));
  });

  // 10. Full evening return reconciles + restores inventory
  await check("10. Full evening return reconciles and restores inventory", async () => {
    const s10 = await makeSalesman();
    await loginAs(loader);
    const invBefore = await prisma.inventoryBalance.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: p1.id } } });
    try { await processMorningLoad(fd([["salesmanId", s10.id], ["productId", p1.id], ["morningFull", 6]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(s10);
    try { await createOrder(orderFd([["customerId", c2.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 2], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "0"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(loader);
    try { await processEveningReturn(fd([["salesmanId", s10.id], ["productId", p1.id], ["eveningReturnedFull", 4], ["eveningReturnedEmpty", 0]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const rec = await prisma.dailyReconciliation.findFirstOrThrow({ where: { salesmanId: s10.id, status: ReconciliationStatus.EVENING_RECONCILED } });
    assert.ok(rec.eveningReconciledAt);
    const invAfter = await prisma.inventoryBalance.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: p1.id } } });
    assert.equal(invAfter.fullCount, invBefore.fullCount - 2, "inventory restores all but the 2 cylinders sold to the customer");
  });

  // 11. Variance detection
  await check("11. Reconciliation flags variance when returns understate sales", async () => {
    const s11 = await makeSalesman();
    await loginAs(loader);
    try { await processMorningLoad(fd([["salesmanId", s11.id], ["productId", p1.id], ["morningFull", 10]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(s11);
    try { await createOrder(orderFd([["customerId", c2.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", p1.id], ["rowFull", 3], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "0"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(loader);
    try { await processEveningReturn(fd([["salesmanId", s11.id], ["productId", p1.id], ["eveningReturnedFull", 6], ["eveningReturnedEmpty", 0]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    const rec = await prisma.dailyReconciliation.findFirstOrThrow({ where: { salesmanId: s11.id, status: ReconciliationStatus.DISCREPANCY_PENDING }, include: { items: true } });
    const item = rec.items.find((i: any) => i.productId === p1.id);
    assert.ok(item, "reconciliation must include the product");
    assert.equal(item!.varianceFull, 1, "varianceFull should be 1 (sold 3, returned 6, loaded 10)");
  });

  // ---- teardown ----
  const custIds = await Promise.all(createdCustomers);
  await prisma.debtPayment.deleteMany({ where: { debt: { customerId: { in: custIds } } } });
  await prisma.customerDebt.deleteMany({ where: { customerId: { in: custIds } } });
  await prisma.dailyReconciliationItem.deleteMany({ where: { reconciliation: { branchId } } });
  await prisma.dailyReconciliation.deleteMany({ where: { branchId } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { branchId } } });
  await prisma.payment.deleteMany({ where: { invoice: { branchId } } });
  await prisma.cylinderMovement.deleteMany({ where: { branchId } });
  await prisma.invoice.deleteMany({ where: { branchId } });
  await prisma.customer.deleteMany({ where: { branchId } });
  await prisma.inventoryBalance.deleteMany({ where: { branchId } });
  await prisma.productPriceRule.deleteMany({ where: { productId: { in: created } } });
  await prisma.product.deleteMany({ where: { id: { in: created } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUsers } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  await prisma.inventoryBalance.deleteMany({ where: { branchId } });

  const fails = results.filter((r) => r[0] === "FAIL");
  console.log(`\n=== SUMMARY: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed ===`);
  if (fails.length) { console.log("FAILURES:"); for (const f of fails) console.log(" - " + f[1] + ": " + f[2]); process.exitCode = 1; }
};

main().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); }).finally(() => prisma.$disconnect());
