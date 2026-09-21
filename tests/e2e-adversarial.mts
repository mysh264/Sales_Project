// Adversarial, multi-branch, multi-role end-to-end test. Drives the REAL server
// actions against the live DB (auth stubbed via /tmp/stub-loader.mjs). Each scenario
// asserts the EXPECTED outcome: legitimate actions succeed, forbidden ones are blocked
// with the right error. Thinks like every user facing real-life edge cases.
import { register } from "node:module";
register("/tmp/stub-loader.mjs", import.meta.url);

const { prisma } = await import("@/lib/prisma");
const { processMorningLoad, processEveningReturn } = await import("@/app/actions/loader");
const { createOrder } = await import("@/app/actions/sales");
const { collectDebt } = await import("@/app/actions/manager");
const { registerCylinder } = await import("@/app/admin/cylinders/actions");
const { generateStatementShareToken } = await import("@/app/actions/statement");

// ---- Users ----
const U = {
  ADMIN: "cmtelrx3200002zobwodnux9o",
  GM: "cmtem0sjp001n5kobmw3td6hf",
  MGR: "cmtem0svl001o5kob3wfc7041",       // Suhar Main
  LOAD: "cmtem0t6y001p5kob5btz70gz",       // Suhar Main
  LOAD_A: "cmtem8b22000101obkdf8dvcw",     // Branch A
  LOAD_B: "cmtem8zw9000301obnxd2w85f",     // Branch B
  SAL: "cmtem0tlt001q5kobcbcrhi7m",        // Suhar Main
  SAL_A: "cmtem0tx7001r5kobghq4ifyh",      // Branch A
  SAL_B: "cmtem0u9e001s5kobjuhwkjg6",      // Branch B
};
const B = { SUHAR: "cmtem0rlb00015kob2k9cefvv", A: "cmtem0rli00025kobz3i6w56a", B: "cmtem0rlm00035kob8vsd7wfh" };

let currentUser = null;
async function asUser(id) {
  currentUser = await prisma.user.findUniqueOrThrow({ where: { id }, include: { branch: true, roleProfile: true } });
  globalThis.__TEST_USER__ = currentUser;
}
function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, String(x)));
    else if (v !== undefined && v !== null) f.append(k, String(v));
  }
  return f;
}

// Pre-cleanup: wipe any leftover routes/invoices for the test salesmen from prior runs
// so each run starts from a clean state (otherwise "already has a completed route" masks scenarios).
const advInv = { invoiceNumber: { startsWith: "ADV-" } };
await prisma.debtPayment.deleteMany({ where: { debt: { invoice: advInv } } });
await prisma.customerDebt.deleteMany({ where: { invoice: advInv } });
await prisma.payment.deleteMany({ where: { invoice: advInv } });
await prisma.invoiceItem.deleteMany({ where: { invoice: advInv } });
await prisma.invoice.deleteMany({ where: advInv });
await prisma.dailyReconciliationItem.deleteMany({ where: { reconciliation: { salesmanId: { in: [U.SAL, U.SAL_A, U.SAL_B] } } } });
await prisma.dailyReconciliation.deleteMany({ where: { salesmanId: { in: [U.SAL, U.SAL_A, U.SAL_B] } } });
await prisma.customer.deleteMany({ where: { name: { startsWith: "ADV-" } } });

// ---- Scenario runner ----
const results = [];
function scen(name, expect, fn) { results.push({ name, expect, fn }); }
function shouldPass(name, fn) { scen(name, { pass: true }, fn); }
function shouldFail(name, substr, fn) { scen(name, { pass: false, substr }, fn); }

// ---- Seed: inventory for all branches + one customer per branch ----
const RUN = `ADV-${Date.now()}`;
const allProducts = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
for (const br of [B.SUHAR, B.A, B.B]) {
  for (const p of allProducts) {
    await prisma.inventoryBalance.upsert({
      where: { branchId_productId: { branchId: br, productId: p.id } },
      update: { fullCount: { increment: 100 } },
      create: { branchId: br, productId: p.id, fullCount: 100, emptyCount: 0 },
    });
  }
}
async function makeCustomer(branchId, name) {
  return prisma.customer.create({ data: { branchId, customerNumber: `${RUN}-${name}`, name, phone: "90000000" } });
}
const custSuhar = await makeCustomer(B.SUHAR, "SuharCust");
const custA = await makeCustomer(B.A, "BranchACust");
const custB = await makeCustomer(B.B, "BranchBCust");

// helper: cheapest priced product in a branch
async function pricedIn(branchId) {
  const p = await prisma.product.findFirst({
    where: { isActive: true },
    include: { priceRules: { where: { branchId, currency: "OMR", endsAt: null } } },
    orderBy: { name: "asc" },
  });
  return { id: p.id, price: p.priceRules[0].minPrice };
}
const pSuhar = await pricedIn(B.SUHAR);
const pA = await pricedIn(B.A);
const pB = await pricedIn(B.B);

function assertMsg(e) {
  let m = e && (e.message || String(e)) || "threw";
  try { m = decodeURIComponent(m.replace(/\+/g, " ")); } catch { /* leave as-is */ }
  return m;
}

// ===================================================================
// 1) LOADER — real-life edge cases
// ===================================================================
shouldPass("LOADER(Suhar) morning load for Suhar salesman", async () => {
  await asUser(U.LOAD);
  await processMorningLoad(fd({ salesmanId: U.SAL, productId: [pSuhar.id], morningFull: [10] }));
});
shouldFail("LOADER morning load EXCEEDING inventory -> blocked", "Insufficient branch inventory", async () => {
  await asUser(U.LOAD);
  // load 9999 when only 100 in stock
  await processMorningLoad(fd({ salesmanId: U.SAL, productId: [pSuhar.id], morningFull: [9999] }));
});
shouldFail("LOADER A (Branch A) morning load for Branch B salesman -> cross-branch blocked", "within your own branch", async () => {
  await asUser(U.LOAD_A);
  await processMorningLoad(fd({ salesmanId: U.SAL_B, productId: [pB.id], morningFull: [5] }));
});
shouldFail("LOADER evening return BEFORE morning load -> blocked", undefined, async () => {
  await asUser(U.LOAD);
  // salesman with no reconciliation today
  await processEveningReturn(fd({ salesmanId: U.SAL_A, reconciliationId: "nope", productId: [pA.id], morningFull: [5], eveningReturnedFull: [5], eveningReturnedEmpty: [0] }));
});
shouldFail("LOADER return EXCEEDING morning load -> blocked", "cannot exceed morning load", async () => {
  await asUser(U.LOAD);
  // Suhar salesman already has a morning load of 10 for pSuhar from scenario 1
  const recon = await prisma.dailyReconciliation.findFirst({ where: { salesmanId: U.SAL }, orderBy: { reconciliationDate: "desc" } });
  await processEveningReturn(fd({ salesmanId: U.SAL, reconciliationId: recon.id, productId: [pSuhar.id], morningFull: [10], eveningReturnedFull: [20], eveningReturnedEmpty: [0] }));
});
shouldFail("LOADER negative qty -> blocked", "whole numbers", async () => {
  await asUser(U.LOAD);
  const recon = await prisma.dailyReconciliation.findFirst({ where: { salesmanId: U.SAL }, orderBy: { reconciliationDate: "desc" } });
  await processEveningReturn(fd({ salesmanId: U.SAL, reconciliationId: recon.id, productId: [pSuhar.id], morningFull: [10], eveningReturnedFull: [-3], eveningReturnedEmpty: [0] }));
});

// ===================================================================
// 2) SALESMAN — real-life edge cases
// ===================================================================
shouldPass("SALESMAN(Suhar) valid order, partial cash -> creates invoice+debt", async () => {
  await asUser(U.SAL);
  await createOrder(fd({
    customerId: custSuhar.id, customerName: custSuhar.name,
    invoiceSerial: `${RUN}-inv`, manualSerial: `${RUN}-m`, submissionToken: `${RUN}-sub1`,
    currency: "OMR", taxRate: "5",
    rowProductId: [pSuhar.id], rowFull: ["2"], rowEmpty: ["0"], rowPrice: [String(pSuhar.price)],
    cashAmount: "1.000",
  }));
});
shouldFail("SALESMAN price BELOW min -> blocked", "must be between", async () => {
  await asUser(U.SAL);
  await createOrder(fd({
    customerId: custSuhar.id, customerName: custSuhar.name,
    invoiceSerial: `${RUN}-inv2`, manualSerial: `${RUN}-m2`, submissionToken: `${RUN}-sub2`,
    currency: "OMR", taxRate: "5",
    rowProductId: [pSuhar.id], rowFull: ["1"], rowEmpty: ["0"], rowPrice: ["0.001"],
    cashAmount: "0",
  }));
});
shouldFail("SALESMAN price ABOVE max -> blocked", "must be between", async () => {
  await asUser(U.SAL);
  await createOrder(fd({
    customerId: custSuhar.id, customerName: custSuhar.name,
    invoiceSerial: `${RUN}-inv3`, manualSerial: `${RUN}-m3`, submissionToken: `${RUN}-sub3`,
    currency: "OMR", taxRate: "5",
    rowProductId: [pSuhar.id], rowFull: ["1"], rowEmpty: ["0"], rowPrice: ["999999"],
    cashAmount: "0",
  }));
});
shouldFail("SALESMAN order for ANOTHER branch customer -> cross-branch blocked", "Customer not found in your branch", async () => {
  await asUser(U.SAL_A); // Branch A salesman
  await createOrder(fd({
    customerId: custB.id, customerName: custB.name, // Branch B customer
    invoiceSerial: `${RUN}-inv4`, manualSerial: `${RUN}-m4`, submissionToken: `${RUN}-sub4`,
    currency: "OMR", taxRate: "5",
    rowProductId: [pA.id], rowFull: ["1"], rowEmpty: ["0"], rowPrice: [String(pA.price)],
    cashAmount: "0",
  }));
});
shouldFail("SALESMAN duplicate submissionToken (double submit) -> blocked (no double invoice)", "already submitted", async () => {
  await asUser(U.SAL);
  const tok = `${RUN}-subDUP`;
  await createOrder(fd({
    customerId: custSuhar.id, customerName: custSuhar.name,
    invoiceSerial: `${RUN}-invD1`, manualSerial: `${RUN}-mD1`, submissionToken: tok,
    currency: "OMR", taxRate: "5",
    rowProductId: [pSuhar.id], rowFull: ["1"], rowEmpty: ["0"], rowPrice: [String(pSuhar.price)], cashAmount: "0",
  }));
  // second identical submission -> should error, not create a 2nd invoice
  await createOrder(fd({
    customerId: custSuhar.id, customerName: custSuhar.name,
    invoiceSerial: `${RUN}-invD2`, manualSerial: `${RUN}-mD2`, submissionToken: tok,
    currency: "OMR", taxRate: "5",
    rowProductId: [pSuhar.id], rowFull: ["1"], rowEmpty: ["0"], rowPrice: [String(pSuhar.price)], cashAmount: "0",
  }));
});
shouldPass("SALESMAN overpayment (cash > total) -> capped, no negative debt", async () => {
  await asUser(U.SAL);
  await createOrder(fd({
    customerId: custSuhar.id, customerName: custSuhar.name,
    invoiceSerial: `${RUN}-inv5`, manualSerial: `${RUN}-m5`, submissionToken: `${RUN}-sub5`,
    currency: "OMR", taxRate: "5",
    rowProductId: [pSuhar.id], rowFull: ["1"], rowEmpty: ["0"], rowPrice: [String(pSuhar.price)], cashAmount: "99999",
  }));
  const inv = await prisma.invoice.findFirst({ where: { customerId: custSuhar.id }, orderBy: { createdAt: "desc" } });
  if (!inv) throw new Error("overpayment invoice not created");
  if (inv.paidAmount.greaterThan(inv.totalAmount)) throw new Error(`paid ${inv.paidAmount} > total ${inv.totalAmount}`);
  if (inv.debtAmount.lessThan(0)) throw new Error(`negative debt ${inv.debtAmount}`);
});

// ===================================================================
// 3) MANAGER / FINANCE — debt collection + branch scope
// ===================================================================
// Create a debt in Branch A to test cross-branch collection by Suhar manager.
// Branch A salesman first needs a morning load (sales require it — correct guard).
await asUser(U.LOAD_A);
await processMorningLoad(fd({ salesmanId: U.SAL_A, productId: [pA.id], morningFull: [10] }));
await asUser(U.SAL_A);
await createOrder(fd({
  customerId: custA.id, customerName: custA.name,
  invoiceSerial: `${RUN}-aInv`, manualSerial: `${RUN}-am`, submissionToken: `${RUN}-asub`,
  currency: "OMR", taxRate: "5",
  rowProductId: [pA.id], rowFull: ["1"], rowEmpty: ["0"], rowPrice: [String(pA.price)], cashAmount: "0",
}));
const debtA = await prisma.customerDebt.findFirst({ where: { customerId: custA.id, balanceAmount: { gt: 0 } } });

shouldFail("MANAGER(Suhar) collects Branch A debt -> cross-branch blocked", "Unauthorized branch access", async () => {
  await asUser(U.MGR);
  await collectDebt(fd({ debtId: debtA.id, amount: debtA.balanceAmount.toString(), method: "CASH" }));
});
shouldPass("GM collects Branch A debt -> allowed (sees all)", async () => {
  await asUser(U.GM);
  await collectDebt(fd({ debtId: debtA.id, amount: debtA.balanceAmount.toString(), method: "CASH" }));
});
shouldFail("MANAGER collects amount > balance -> blocked", "cannot exceed debt balance", async () => {
  await asUser(U.MGR);
  // Suhar debt from scenario 2
  const d = await prisma.customerDebt.findFirst({ where: { customerId: custSuhar.id, balanceAmount: { gt: 0 } } });
  await collectDebt(fd({ debtId: d.id, amount: d.balanceAmount.add(100).toString(), method: "CASH" }));
});
shouldFail("MANAGER collects ZERO -> blocked", "greater than zero", async () => {
  await asUser(U.MGR);
  const d = await prisma.customerDebt.findFirst({ where: { customerId: custSuhar.id, balanceAmount: { gt: 0 } } });
  await collectDebt(fd({ debtId: d.id, amount: "0", method: "CASH" }));
});

// ===================================================================
// 4) FINANCE statement token + branch scope
// ===================================================================
shouldPass("GM generates statement for Branch B customer -> allowed", async () => {
  await asUser(U.GM);
  const t = await generateStatementShareToken(fd({ customerId: custB.id }));
  if (typeof t !== "string" || t.length === 0) throw new Error("no token returned");
});
shouldFail("MANAGER(Suhar) generates statement for Branch A customer -> blocked", undefined, async () => {
  // manager is branch-scoped; customer not in scope => customer not found => no token
  await asUser(U.MGR);
  const t = await generateStatementShareToken(fd({ customerId: custA.id }));
  if (typeof t === "string" && t.length > 0) throw new Error("token unexpectedly returned for cross-branch customer");
});

// ===================================================================
// 5) ADMIN cylinder registry
// ===================================================================
shouldPass("ADMIN registers cylinder in another branch -> allowed", async () => {
  await asUser(U.ADMIN);
  await registerCylinder(fd({ branchId: B.B, productId: pB.id, serial: `${RUN}-CYL-B` }));
});
shouldPass("ADMIN re-registers SAME serial -> upsert, no duplicate", async () => {
  await asUser(U.ADMIN);
  const serial = `${RUN}-CYL-DUP`;
  await registerCylinder(fd({ branchId: B.SUHAR, productId: pSuhar.id, serial }));
  await registerCylinder(fd({ branchId: B.SUHAR, productId: pSuhar.id, serial }));
  const n = await prisma.cylinder.count({ where: { serial } });
  if (n !== 1) throw new Error(`expected 1 cylinder, got ${n}`);
});

// ===================================================================
// RUN
// ===================================================================
let pass = 0, fail = 0;
for (const s of results) {
  let threw = null, threwMsg = "";
  try { await s.fn(); } catch (e) { threw = e; threwMsg = assertMsg(e); }
  let ok;
  if (s.expect.pass) ok = !threw;
  else ok = threw && (!s.expect.substr || threwMsg.toLowerCase().includes(s.expect.substr.toLowerCase()));
  if (ok) { pass++; console.log(`PASS  ${s.name}`); }
  else { fail++; const got = threw ? `threw: ${threwMsg}` : "succeeded unexpectedly"; console.log(`FAIL  ${s.name} — expected ${s.expect.pass ? "success" : `error ~"${s.expect.substr}"`}, got ${got}`); }
}
console.log(`\n=== ADVERSARIAL SUMMARY: ${pass}/${results.length} passed, ${fail} failed ===`);
// cleanup E2E data (children before parents). Filter debts/payments by RUN invoice number
// so every row tied to a RUN invoice is removed regardless of customer-name quirks.
const invFilter = { invoice: { invoiceNumber: { startsWith: RUN } } };
await prisma.debtPayment.deleteMany({ where: { debt: invFilter } });
await prisma.customerDebt.deleteMany({ where: invFilter });
await prisma.payment.deleteMany({ where: invFilter });
await prisma.invoiceItem.deleteMany({ where: invFilter });
await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: RUN } } });
await prisma.dailyReconciliationItem.deleteMany({ where: { reconciliation: { salesmanId: { in: [U.SAL, U.SAL_A, U.SAL_B] } } } });
await prisma.dailyReconciliation.deleteMany({ where: { salesmanId: { in: [U.SAL, U.SAL_A, U.SAL_B] } } });
await prisma.customer.deleteMany({ where: { name: { startsWith: RUN } } });
await prisma.cylinder.deleteMany({ where: { serial: { startsWith: RUN } } });
process.exit(fail ? 1 : 0);
