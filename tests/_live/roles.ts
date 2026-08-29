import assert from "node:assert/strict";
import { inspect } from "node:util";
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
import { PrismaClient, Prisma, UserRole, DebtStatus, InvoiceStatus, ReconciliationStatus, PaymentMethod } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import * as stub from "./next-headers-stub.mjs";
import { createOrder } from "@/app/actions/sales";
import { processMorningLoad, processEveningReturn } from "@/app/actions/loader";
import { writeOffDebt, collectDebt } from "@/app/actions/manager";
import { adjustInventory } from "@/app/actions/inventory";
import { createUser, updateUserRole, toggleGlobalSalesView } from "@/app/actions/users";
import { resetUserPassword } from "@/app/actions/security";
import { getFinancialSummary } from "@/app/actions/finance";

const results: Array<[string, string, string]> = [];
function check(name: string, fn: () => Promise<void>) {
  return (async () => {
    try { await fn(); results.push(["PASS", name, ""]); console.log("PASS  " + name); }
    catch (e: any) {
      if (isSuccessRedirect(e)) { results.push(["PASS", name, ""]); console.log("PASS  " + name); return; }
      const insp = inspect(e, { depth: 1 }).split("\n").slice(0, 3).join(" | ");
      results.push(["FAIL", name, insp]); console.log("FAIL  " + name + "  -> " + insp);
    }
  })();
}
async function rejected(name: string, fn: () => Promise<void>) {
  await check(name, async () => {
    let threw = false, ok = false;
    try { await fn(); } catch (e: any) { threw = true; ok = isSuccessRedirect(e); }
    assert.equal(threw && !ok, true, "expected the action to be rejected");
  });
}
function jwtSecret() {
  const env = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  const secret = env.split("\n").find((l: string) => l.startsWith("JWT_SECRET="))!.split("=")[1].trim();
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

const main = async () => {
  const env = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  const secret = env.split("\n").find((l: string) => l.startsWith("JWT_SECRET="))!.split("=")[1].trim();
  process.env.JWT_SECRET = secret;

  // Two branches for cross-branch testing.
  const branchA = await prisma.branch.findFirstOrThrow({ where: { code: "SUHAR_MAIN" } });
  const branchB = await prisma.branch.upsert({
    where: { code: "MUSCAT_MAIN" },
    update: {},
    create: { code: "MUSCAT_MAIN", name: "Muscat Main", companyId: branchA.companyId, defaultCurrency: "OMR", defaultTaxRate: new Prisma.Decimal("5"), defaultPhoneCode: "+968" },
  });
  const companyId = branchA.companyId;

  // Idempotent cleanup so a rerun never aggregates contaminated data from a prior run.
  await prisma.debtPayment.deleteMany({ where: { debt: { customer: { branchId: { in: [branchA.id, branchB.id] } } } } });
  await prisma.customerDebt.deleteMany({ where: { customer: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.dailyReconciliationItem.deleteMany({ where: { reconciliation: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.dailyReconciliation.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.payment.deleteMany({ where: { invoice: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.cylinderMovement.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.invoice.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.customer.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  const roleUserIds = (await prisma.user.findMany({ where: { email: { startsWith: "role-" } }, select: { id: true } })).map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { userId: { in: roleUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: roleUserIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.productPriceRule.deleteMany({ where: { product: { name: { startsWith: "ROLECYL" } } } });
  await prisma.product.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] }, name: { startsWith: "ROLECYL" } } });

  const mkUser = (role: UserRole, branchId: string, suffix: string) => prisma.user.create({
    data: { email: `role-${role}-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`, fullName: `Role ${role} ${suffix}`, role, branchId, passwordHash: "x", sessionVersion: 1, isActive: true },
  });

  const users: Record<string, any> = {};
  const roleSpecs: Array<[string, UserRole, string]> = [
    ["salesmanA", UserRole.SALESMAN, branchA.id],
    ["loaderA", UserRole.LOADER, branchA.id],
    ["managerA", UserRole.MANAGER, branchA.id],
    ["gmA", UserRole.GENERAL_MANAGER, branchA.id],
    ["admin", UserRole.ADMIN, branchA.id],
    ["salesmanB", UserRole.SALESMAN, branchB.id],
    ["loaderB", UserRole.LOADER, branchB.id],
    ["managerB", UserRole.MANAGER, branchB.id],
  ];
  for (const [k, role, bid] of roleSpecs) {
    users[k] = await mkUser(role, bid, k);
  }

  const mkProduct = async (branchId: string) => {
    const p = await prisma.product.create({ data: { name: "ROLECYL", sku: "ROLECYL-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), gasType: "OXYGEN", cylinderSize: "50L", isActive: true, branchId, priceRules: { create: [{ branchId, minPrice: new Prisma.Decimal("1"), maxPrice: new Prisma.Decimal("100"), startsAt: new Date("2000-01-01") }] } } });
    await prisma.inventoryBalance.create({ data: { branchId, productId: p.id, fullCount: 500, emptyCount: 500 } });
    return p;
  };
  const pA = await mkProduct(branchA.id);
  const pB = await mkProduct(branchB.id);
  const mkCustomer = (branchId: string) => prisma.customer.create({ data: { branchId, name: "RoleCust", phone: "9" + Math.floor(Math.random() * 1e8), customerNumber: "RC-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5), taxRate: new Prisma.Decimal("5") } });

  console.log("\n=== PER-ROLE LIVE BOUNDARY TESTS (real actions vs live DB) ===\n");

  // ---------- SALESMAN (branch A) ----------
  const custA = await mkCustomer(branchA.id);
  await check("SALESMAN: can create an order (allowed)", async () => {
    await loginAs(users.loaderA);
    try { await processMorningLoad(fd([["salesmanId", users.salesmanA.id], ["productId", pA.id], ["morningFull", 10]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(users.salesmanA);
    try { await createOrder(orderFd([["customerId", custA.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", pA.id], ["rowFull", 1], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
  });
  await rejected("SALESMAN: cannot adjust inventory (no Inventory_Update)", async () => {
    await loginAs(users.salesmanA);
    await adjustInventory(fd([["branchId", branchA.id], ["productId", pA.id], ["fullDelta", 1], ["emptyDelta", 0], ["reason", "x"]]));
  });
  await rejected("SALESMAN: cannot write off debt (no Finance_Update)", async () => {
    await loginAs(users.salesmanA);
    await writeOffDebt(fd([["debtId", "does-not-matter"], ["reason", "reason long enough"]]));
  });
  await rejected("SALESMAN: cannot create users (no Users_Update)", async () => {
    await loginAs(users.salesmanA);
    await createUser(fd([["fullName", "X"], ["email", "x@y.z"], ["password", "longpassword123"], ["role", "SALESMAN"], ["branchId", branchA.id]]));
  });
  await rejected("SALESMAN: cannot record morning load (Logistics_Update required)", async () => {
    await loginAs(users.salesmanA);
    await processMorningLoad(fd([["salesmanId", users.salesmanA.id], ["productId", pA.id], ["morningFull", 1]]));
  });
  await rejected("SALESMAN: cannot read finance summary (no Finance_Read)", async () => {
    await loginAs(users.salesmanA);
    await getFinancialSummary({});
  });

  // ---------- LOADER (branch A) ----------
  await check("LOADER: can record morning load for branch-A salesman (allowed)", async () => {
    await loginAs(users.loaderA);
    try { await processMorningLoad(fd([["salesmanId", users.salesmanA.id], ["productId", pA.id], ["morningFull", 5]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
  });
  await rejected("LOADER: cannot record morning load for branch-B salesman (cross-branch)", async () => {
    await loginAs(users.loaderA);
    try { await processMorningLoad(fd([["salesmanId", users.salesmanB.id], ["productId", pB.id], ["morningFull", 5]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
  });
  await rejected("LOADER: cannot create an order (no Sales_Create)", async () => {
    await loginAs(users.loaderA);
    await createOrder(orderFd([["customerId", custA.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", pA.id], ["rowFull", 1], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]]));
  });
  await rejected("LOADER: cannot write off debt (no Finance_Update)", async () => {
    await loginAs(users.loaderA);
    await writeOffDebt(fd([["debtId", "x"], ["reason", "reason long enough"]]));
  });

  // ---------- MANAGER (branch A) ----------
  const custM = await mkCustomer(branchA.id);
  const custMdebt = await (async () => {
    await loginAs(users.loaderA);
    try { await processMorningLoad(fd([["salesmanId", users.salesmanA.id], ["productId", pA.id], ["morningFull", 10]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(users.salesmanA);
    try { await createOrder(orderFd([["customerId", custM.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", pA.id], ["rowFull", 4], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    return prisma.customerDebt.findFirstOrThrow({ where: { customerId: custM.id, status: { in: [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID] } } });
  })();
  await check("MANAGER: can write off debt for branch-A customer (allowed)", async () => {
    await loginAs(users.managerA);
    await writeOffDebt(fd([["debtId", custMdebt.id], ["reason", "Approved write-off per policy."]]));
  });
  // debt in branch B
  const custBdebt = await (async () => {
    await loginAs(users.loaderB);
    try { await processMorningLoad(fd([["salesmanId", users.salesmanB.id], ["productId", pB.id], ["morningFull", 10]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(users.salesmanB);
    try { await createOrder(orderFd([["customerId", (await mkCustomer(branchB.id)).id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", pB.id], ["rowFull", 4], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    return prisma.customerDebt.findFirstOrThrow({ where: { customer: { branchId: branchB.id }, status: { in: [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID] } } });
  })();
  await rejected("MANAGER: cannot write off debt for branch-B customer (cross-branch)", async () => {
    await loginAs(users.managerA);
    await writeOffDebt(fd([["debtId", custBdebt.id], ["reason", "Approved write-off per policy."]]));
  });
  await check("MANAGER: can adjust inventory in own branch (allowed)", async () => {
    await loginAs(users.managerA);
    await adjustInventory(fd([["branchId", branchA.id], ["productId", pA.id], ["fullDelta", 1], ["emptyDelta", 0], ["reason", "cycle count"]]));
  });
  await rejected("MANAGER: cannot adjust inventory in branch B (cross-branch)", async () => {
    await loginAs(users.managerA);
    await adjustInventory(fd([["branchId", branchB.id], ["productId", pB.id], ["fullDelta", 1], ["emptyDelta", 0], ["reason", "cycle count"]]));
  });
  await rejected("MANAGER: cannot create an ADMIN user (privilege escalation)", async () => {
    await loginAs(users.managerA);
    await createUser(fd([["fullName", "X"], ["email", "xadmin@y.z"], ["password", "longpassword123"], ["role", "ADMIN"], ["branchId", branchA.id]]));
  });
  await rejected("MANAGER: cannot create a GENERAL_MANAGER user (privilege escalation)", async () => {
    await loginAs(users.managerA);
    await createUser(fd([["fullName", "X"], ["email", "xgm@y.z"], ["password", "longpassword123"], ["role", "GENERAL_MANAGER"], ["branchId", branchA.id]]));
  });
  await rejected("MANAGER: cannot reset an ADMIN password (privilege escalation)", async () => {
    await loginAs(users.managerA);
    await resetUserPassword(fd([["userId", users.admin.id], ["newPassword", "longpassword123"]]));
  });
  await rejected("MANAGER: cannot demote an ADMIN to SALESMAN (privilege escalation)", async () => {
    await loginAs(users.managerA);
    await updateUserRole(fd([["userId", users.admin.id], ["newRole", "SALESMAN"]]));
  });
  await check("MANAGER: finance summary is scoped to own branch (no cross-branch leak)", async () => {
    await loginAs(users.managerA);
    const summary = await getFinancialSummary({});
    assert.equal(summary.scope, "branch");
    // branch B has its own debt; manager A must not see it
    assert.equal(summary.totalOutstandingDebt, "0.000", "branch-B debt must NOT appear in branch-A manager's summary");
  });

  // ---------- GENERAL_MANAGER (branch A) ----------
  await check("GM: can create a MANAGER user (allowed)", async () => {
    await loginAs(users.gmA);
    await createUser(fd([["fullName", "X"], ["email", `gm-mgr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@y.z`], ["password", "longpassword123"], ["role", "MANAGER"], ["branchId", branchA.id]]));
  });
  await rejected("GM: cannot create an ADMIN user (privilege escalation)", async () => {
    await loginAs(users.gmA);
    await createUser(fd([["fullName", "X"], ["email", "xadmingm@y.z"], ["password", "longpassword123"], ["role", "ADMIN"], ["branchId", branchA.id]]));
  });
  await check("GM: can grant global sales view (allowed)", async () => {
    await loginAs(users.gmA);
    await toggleGlobalSalesView(fd([["userId", users.managerA.id], ["currentStatus", "false"]]));
  });
  await rejected("GM: cannot demote an ADMIN (privilege escalation)", async () => {
    await loginAs(users.gmA);
    await updateUserRole(fd([["userId", users.admin.id], ["newRole", "MANAGER"]]));
  });

  // ---------- ADMIN ----------
  await check("ADMIN: can create an ADMIN user in any branch (allowed)", async () => {
    await loginAs(users.admin);
    await createUser(fd([["fullName", "X"], ["email", `admin-b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@y.z`], ["password", "longpassword123"], ["role", "ADMIN"], ["branchId", branchB.id]]));
  });
  await check("ADMIN: can adjust inventory in branch B (global)", async () => {
    await loginAs(users.admin);
    await adjustInventory(fd([["branchId", branchB.id], ["productId", pB.id], ["fullDelta", 1], ["emptyDelta", 0], ["reason", "admin cycle"]]));
  });
  await check("ADMIN: finance summary is global", async () => {
    await loginAs(users.admin);
    const summary = await getFinancialSummary({});
    assert.equal(summary.scope, "global");
  });
  await check("ADMIN: can write off branch-B debt (global)", async () => {
    await loginAs(users.admin);
    await writeOffDebt(fd([["debtId", custBdebt.id], ["reason", "Admin-approved write-off."]]));
  });

  // ---------- cross-branch salesman sell attempt ----------
  await rejected("SALESMAN: cannot sell using a branch-B product id (scope enforced)", async () => {
    await loginAs(users.loaderA);
    try { await processMorningLoad(fd([["salesmanId", users.salesmanA.id], ["productId", pA.id], ["morningFull", 10]])); } catch (e: any) { if (!isSuccessRedirect(e)) throw e; }
    await loginAs(users.salesmanA);
    // salesmanA's branch is A; pB belongs to branch B -> price rule lookup should reject (no active rule in branch A)
    await createOrder(orderFd([["customerId", custA.id], ["currency", "OMR"], ["taxRate", "5"], ["rowProductId", pB.id], ["rowFull", 1], ["rowEmpty", 0], ["rowPrice", "10"], ["cashAmount", "10.5"]]));
  });

  // ---- teardown ----
  await prisma.debtPayment.deleteMany({ where: { debt: { customer: { branchId: { in: [branchA.id, branchB.id] } } } } });
  await prisma.customerDebt.deleteMany({ where: { customer: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.dailyReconciliationItem.deleteMany({ where: { reconciliation: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.dailyReconciliation.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.payment.deleteMany({ where: { invoice: { branchId: { in: [branchA.id, branchB.id] } } } });
  await prisma.cylinderMovement.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.invoice.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.customer.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.inventoryBalance.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } });
  await prisma.productPriceRule.deleteMany({ where: { productId: { in: [pA.id, pB.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [pA.id, pB.id] } } });
  const createdUserIds = Object.values(users).map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.branch.deleteMany({ where: { id: branchB.id } });

  const fails = results.filter((r) => r[0] === "FAIL");
  console.log(`\n=== SUMMARY: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed ===`);
  if (fails.length) { console.log("FAILURES:"); for (const f of fails) console.log(" - " + f[1] + ": " + f[2]); process.exitCode = 1; }
};

main().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); }).finally(() => prisma.$disconnect());
