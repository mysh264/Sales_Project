import assert from "node:assert/strict";
import test from "node:test";
import { isInvoiceBalanced, roundMoney, roundRate } from "../lib/money";

test("roundMoney applies the database's three-decimal scale before financial arithmetic", () => {
  assert.equal(roundMoney("1.0004").toString(), "1");
  assert.equal(roundMoney("0.0005").toString(), "0.001");
});

test("roundRate applies the database's four-decimal tax-rate scale", () => {
  assert.equal(roundRate("5.12504").toString(), "5.125");
});

test("isInvoiceBalanced rejects a one-baisa stored mismatch", () => {
  assert.equal(
    isInvoiceBalanced({ totalAmount: "1.000", paidAmount: "0.001", debtAmount: "1.000" }),
    false,
  );
});

test("isInvoiceBalanced treats written-off debt as settled but not paid", () => {
  assert.equal(
    isInvoiceBalanced({
      totalAmount: "10.000",
      paidAmount: "0.000",
      debtAmount: "0.000",
      writtenOffAmount: "10.000",
    }),
    true,
  );
});
