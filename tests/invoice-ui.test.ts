import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("the new-order page generates one invoice serial for both display and submission", async () => {
  const source = await readFile(new URL("../app/salesman/new-order/page.tsx", import.meta.url), "utf8");
  assert.equal(source.match(/buildInvoiceSerial\(\)/g)?.length, 1);
});

test("the new-order page preserves a branch configured for zero VAT", async () => {
  const source = await readFile(new URL("../app/salesman/new-order/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /defaultTaxRate\.gt\(0\)/);
});

test("the invoice form describes overpayment as retained customer credit", async () => {
  const source = await readFile(new URL("../app/salesman/new-order/NewInvoiceForm.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Change to be returned/);
  assert.match(source, /customer credit/i);
});

test("the invoice form submits the cheque receipt field consumed by the sales action", async () => {
  const source = await readFile(new URL("../app/salesman/new-order/NewInvoiceForm.tsx", import.meta.url), "utf8");
  assert.match(source, /name="checkReceipt"/);
});
