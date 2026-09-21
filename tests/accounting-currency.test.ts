import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { resolveInvoiceCurrency } from "@/lib/accounting-currency";
import { assertWriteOffAuthorized, DEFAULT_MANAGER_WRITE_OFF_LIMIT } from "@/lib/write-off-policy";
import { UserRole } from "@/generated/prisma/client";
import { readFile } from "node:fs/promises";

test("invoice currency may differ from branch default when customer has no credit or open debt", () => {
  const currency = resolveInvoiceCurrency({
    submittedCurrency: "USD",
    branchDefaultCurrency: "OMR",
    creditBalance: 0,
    openDebtCurrencies: [],
  });
  assert.equal(currency, "USD");
});

test("invoice currency locks to branch default when customer credit exists", () => {
  assert.throws(
    () =>
      resolveInvoiceCurrency({
        submittedCurrency: "USD",
        branchDefaultCurrency: "OMR",
        creditBalance: new Prisma.Decimal("1.000"),
        openDebtCurrencies: [],
      }),
    /locked to OMR/,
  );
});

test("invoice currency locks to existing open-debt currency", () => {
  const currency = resolveInvoiceCurrency({
    submittedCurrency: "AED",
    branchDefaultCurrency: "OMR",
    creditBalance: 0,
    openDebtCurrencies: ["AED"],
  });
  assert.equal(currency, "AED");
});

test("mixed open-debt currencies are rejected", () => {
  assert.throws(
    () =>
      resolveInvoiceCurrency({
        submittedCurrency: "OMR",
        branchDefaultCurrency: "OMR",
        creditBalance: 0,
        openDebtCurrencies: ["OMR", "USD"],
      }),
    /multiple currencies/,
  );
});

test("manager write-off above limit is rejected; admin is allowed", () => {
  const over = DEFAULT_MANAGER_WRITE_OFF_LIMIT.add(1);
  assert.throws(() => assertWriteOffAuthorized(UserRole.MANAGER, over), /require an administrator/);
  assert.doesNotThrow(() => assertWriteOffAuthorized(UserRole.ADMIN, over));
  assert.doesNotThrow(() => assertWriteOffAuthorized(UserRole.MANAGER, DEFAULT_MANAGER_WRITE_OFF_LIMIT));
});

test("user mutations wrap user row and audit in one transaction", async () => {
  const source = await readFile(new URL("../app/actions/users.ts", import.meta.url), "utf8");
  for (const fn of ["createUser", "toggleUserStatus", "updateUserRole"]) {
    const start = source.indexOf(`export async function ${fn}`);
    assert.ok(start >= 0, fn);
    const next = source.indexOf("export async function", start + 1);
    const body = source.slice(start, next === -1 ? undefined : next);
    assert.match(body, /prisma\.\$transaction\(async \(tx\) =>/);
    assert.match(body, /\{\s*tx\s*\}/);
  }
});

test("writeOffDebt enforces write-off policy", async () => {
  const source = await readFile(new URL("../app/actions/manager.ts", import.meta.url), "utf8");
  assert.match(source, /assertWriteOffAuthorized\(actor\.role,\s*writtenOffAmount\)/);
});
