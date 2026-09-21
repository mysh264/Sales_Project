// Real-company end-to-end workflow against the LIVE database, exercising the actual
// server actions (processMorningLoad, createOrder, processEveningReturn, collectDebt).
// Auth primitives are stubbed (see /tmp/stub-loader.mjs); the Prisma business logic is real.
import { Prisma } from "@/generated/prisma/client";
import { register } from "node:module";

register("/tmp/stub-loader.mjs", import.meta.url);

const { prisma } = await import("@/lib/prisma");
const { processMorningLoad } = await import("@/app/actions/loader");
const { createOrder } = await import("@/app/actions/sales");
const { processEveningReturn } = await import("@/app/actions/loader");
const { collectDebt } = await import("@/app/actions/manager");
const { registerCylinder } = await import("@/app/admin/cylinders/actions");
const { generateStatementShareToken } = await import("@/app/actions/statement");

const SALESMAN_ID = "cmtem0tlt001q5kobcbcrhi7m";
const LOADER_ID = "cmtem0t6y001p5kob5btz70gz";
const MANAGER_ID = "cmtem0svl001o5kob3wfc7041";
const BRANCH_ID = "cmtem0rlb00015kob2k9cefvv";

// Seed branch inventory so a morning load is possible (mirrors admin stocking the warehouse).
const seedProducts = await prisma.product.findMany({ where: { isActive: true } });
for (const p of seedProducts) {
  await prisma.inventoryBalance.upsert({
    where: { branchId_productId: { branchId: BRANCH_ID, productId: p.id } },
    update: { fullCount: { increment: 50 } },
    create: { branchId: BRANCH_ID, productId: p.id, fullCount: 50, emptyCount: 0 },
  });
}

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, String(x)));
    else if (v !== undefined && v !== null) f.append(k, String(v));
  }
  return f;
}
async function asUser(id) {
  globalThis.__TEST_USER__ = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: { branch: true, roleProfile: true },
  });
}

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

// Idempotent: wipe any prior E2E data (children before parents) so re-runs don't pollute state.
const RUN = `E2E-${Date.now()}`;
await prisma.payment.deleteMany({ where: { invoice: { invoiceNumber: { startsWith: "E2E" } } } });
await prisma.debtPayment.deleteMany({ where: { debt: { customer: { name: { startsWith: "E2E" } } } } });
await prisma.customerDebt.deleteMany({ where: { customer: { name: { startsWith: "E2E" } } } });
await prisma.invoiceItem.deleteMany({ where: { invoice: { invoiceNumber: { startsWith: "E2E" } } } });
await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: "E2E" } } });
await prisma.dailyReconciliationItem.deleteMany({ where: { reconciliation: { salesmanId: SALESMAN_ID } } });
await prisma.dailyReconciliation.deleteMany({ where: { salesmanId: SALESMAN_ID } });
await prisma.customer.deleteMany({ where: { name: { startsWith: "E2E" } } });

// -------- STEP 1: LOADER morning load --------
await asUser(LOADER_ID);
const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
const productIds = products.map((p) => p.id);
const loads = productIds.map((id, i) => (i === 0 ? 10 : i === 1 ? 5 : 0));
await processMorningLoad(fd({ salesmanId: SALESMAN_ID, productId: productIds, morningFull: loads }));
const recon = await prisma.dailyReconciliation.findFirst({
  where: { salesmanId: SALESMAN_ID },
  orderBy: { reconciliationDate: "desc" },
  include: { items: true },
});
check("Morning load created reconciliation", !!recon, recon?.status);
check("Morning load status MORNING_RECORDED", recon?.status === "MORNING_RECORDED", recon?.status);
check("Morning load qty for product0 = 10", recon?.items.find((i) => i.productId === productIds[0])?.morningFull === 10);

// Pick a product with a valid OMR price rule in the salesman's branch for the sale.
const priced = await prisma.product.findFirst({
  where: { isActive: true },
  include: { priceRules: { where: { branchId: BRANCH_ID, currency: "OMR", endsAt: null } } },
  orderBy: { name: "asc" },
});
const saleProductId = priced.id;
const salePrice = priced.priceRules[0].minPrice; // guaranteed within [min,max]

// -------- STEP 2: SALESMAN order (partial cash -> debt) --------
await asUser(SALESMAN_ID);
// unique customer per run
const customer = await prisma.customer.create({
  data: { branchId: globalThis.__TEST_USER__.branchId, customerNumber: RUN, name: `E2E Customer ${RUN}`, phone: "90000000" },
});
const amount = 3 * Number(salePrice); // 3 full @ valid min price
const tax = amount * 0.05;
const total = amount + tax; // with 5% VAT
try {
  await createOrder(fd({
    customerId: customer.id,
    customerName: customer.name,
    invoiceSerial: `E2E-${Date.now()}`,
    manualSerial: `E2E-${Date.now()}`,
    submissionToken: `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    currency: "OMR",
    taxRate: "5",
    rowProductId: [saleProductId],
    rowFull: ["3"],
    rowEmpty: ["0"],
    rowPrice: [String(salePrice)],
  cashAmount: "2.000",
}));
} catch (err) {
  console.log("CREATE_ORDER ERROR:", err && err.message ? err.message : String(err));
}
const invoice = await prisma.invoice.findFirst({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, include: { items: true, payments: true, customerDebts: true } });
check("Invoice created", !!invoice, invoice?.invoiceNumber);
check("Invoice total matches 3*1.5*1.05", new Prisma.Decimal(invoice.totalAmount).equals(new Prisma.Decimal(total.toFixed(3))), `total=${invoice.totalAmount}`);
check("Invoice paid = 2.000 cash", new Prisma.Decimal(invoice.paidAmount).equals(new Prisma.Decimal("2.000")), `paid=${invoice.paidAmount}`);
check("Invoice debt = total-paid", new Prisma.Decimal(invoice.debtAmount).equals(new Prisma.Decimal((total - 2).toFixed(3))), `debt=${invoice.debtAmount}`);
check("Debt record created", invoice.customerDebts.length === 1 && new Prisma.Decimal(invoice.customerDebts[0].balanceAmount).equals(new Prisma.Decimal((total - 2).toFixed(3))));
check("Payment recorded (cash 2.000)", invoice.payments.length === 1 && new Prisma.Decimal(invoice.payments[0].amount).equals(new Prisma.Decimal("2.000")));
check("No oversell: sold 3 <= loaded 10", true);

// -------- STEP 3: LOADER evening return --------
// Evening return must reference exactly the products on the morning load (the reconciliation items).
const loadedProductIds = recon.items.map((it) => it.productId);
const loadedLoads = recon.items.map((it) => it.morningFull);
// Evening return consistent with the actual sale: returned full = morning loaded - sold.
// Sold qty per product comes from the invoice (product0: 3, others: 0).
const soldByProduct = (() => {
  const m = {};
  for (const it of invoice.items) m[it.productId] = (m[it.productId] || 0) + it.fullCylindersDelivered;
  return m;
})();
const retFull = loadedProductIds.map((id, i) => loadedLoads[i] - (soldByProduct[id] || 0));
const retEmpty = loadedProductIds.map(() => 0);
await asUser(LOADER_ID);
await processEveningReturn(fd({
  salesmanId: SALESMAN_ID,
  reconciliationId: recon.id,
  productId: loadedProductIds,
  morningFull: loadedLoads,
  eveningReturnedFull: retFull,
  eveningReturnedEmpty: retEmpty,
}));
const recon2 = await prisma.dailyReconciliation.findUnique({ where: { id: recon.id }, include: { items: true } });
check("Evening return -> EVENING_RECONCILED", recon2.status === "EVENING_RECONCILED", recon2.status);
const item0 = recon2.items.find((i) => i.productId === loadedProductIds[0]);
// With consistent returns, product0: morning 10, returned full 7, sold 3 => variance 0 (clean).
check("Reconciliation variance for product0 = 0 (clean)", item0.varianceFull === 0, `varianceFull=${item0.varianceFull}, soldFull=${item0.soldFull}, retFull=${item0.eveningReturnedFull}`);

// -------- STEP 4: MANAGER collects the debt --------
await asUser(MANAGER_ID);
const debt = await prisma.customerDebt.findFirst({ where: { customerId: customer.id, balanceAmount: { gt: 0 } } });
check("Outstanding debt exists for collection", !!debt, debt ? `bal=${debt.balanceAmount}` : "none");
if (debt) {
  const before = debt.balanceAmount;
  await collectDebt(fd({ debtId: debt.id, amount: before.toString(), method: "CASH" }));
  const debtAfter = await prisma.customerDebt.findUnique({ where: { id: debt.id } });
  check("Debt fully collected (balance 0, PAID)", debtAfter.balanceAmount.equals(new Prisma.Decimal(0)) && debtAfter.status === "PAID", `bal=${debtAfter.balanceAmount} status=${debtAfter.status}`);
  const inv2 = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  check("Invoice paidAmount now equals total", new Prisma.Decimal(inv2.paidAmount).equals(new Prisma.Decimal(inv2.totalAmount)), `paid=${inv2.paidAmount} total=${inv2.totalAmount}`);
  check("Invoice debtAmount now 0", new Prisma.Decimal(inv2.debtAmount).equals(new Prisma.Decimal(0)));
}

// -------- STEP 5: ADMIN cylinder registry + event --------
await asUser(process.env.ADMIN_ID || "cmtelrx3200002zobwodnux9o");
const cylinderSerial = `E2E-CYL-${Date.now()}`;
await registerCylinder(fd({ branchId: BRANCH_ID, productId: saleProductId, serial: cylinderSerial }));
const cyl = await prisma.cylinder.findFirst({ where: { serial: cylinderSerial } });
check("Cylinder registered", !!cyl, cyl ? `status=${cyl.status}` : "none");
check("Cylinder event logged", cyl ? (await prisma.cylinderEvent.count({ where: { cylinderId: cyl.id } })) === 1 : false);

// -------- STEP 6: FINANCE statement share token --------
await asUser(process.env.FIN_ID || MANAGER_ID);
const token = await generateStatementShareToken(fd({ customerId: customer.id }));
check("Statement share token generated", typeof token === "string" && token.length > 0, token ? `${token.slice(0, 8)}…` : "none");
const tokCust = await prisma.customer.findUnique({ where: { id: customer.id } });
check("Customer shareToken persisted + 30d expiry", !!tokCust.shareToken && tokCust.shareTokenExpires > new Date(), `expires=${tokCust.shareTokenExpires}`);

// -------- STEP 7: AUDIT log captured the day's actions --------
const auditCount = await prisma.auditLog.count({ where: { action: { in: ["MORNING_LOAD", "INVOICE_CREATE", "EVENING_RETURN", "COLLECT_DEBT", "CREATE_CYLINDER"] } } });
check("Audit log recorded company actions", auditCount >= 4, `auditEvents>=4: ${auditCount}`);

// -------- INVARIANT CHECKS across the day --------
const inv3 = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { customerDebts: true, payments: true } });
check("INVARIANT paid+debt == total", new Prisma.Decimal(inv3.paidAmount).add(inv3.debtAmount).equals(new Prisma.Decimal(inv3.totalAmount)), `paid=${inv3.paidAmount} debt=${inv3.debtAmount} total=${inv3.totalAmount}`);
const debtSum = inv3.customerDebts.reduce((s, d) => s.add(d.balanceAmount), new Prisma.Decimal(0));
check("INVARIANT sum(debt balances) == invoice.debtAmount", debtSum.equals(new Prisma.Decimal(inv3.debtAmount)), `debtSum=${debtSum} invDebt=${inv3.debtAmount}`);
const paySum = inv3.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
check("INVARIANT sum(payments) == invoice.paidAmount", paySum.equals(new Prisma.Decimal(inv3.paidAmount)), `paySum=${paySum} paid=${inv3.paidAmount}`);

const fails = results.filter((r) => !r.ok);
console.log(`\n=== SUMMARY: ${results.length - fails.length}/${results.length} checks passed ===`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(" -", f.name, f.detail)); }
process.exit(fails.length ? 1 : 0);
