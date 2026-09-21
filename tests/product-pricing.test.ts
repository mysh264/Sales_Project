import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { priceBandForCurrency } from "../lib/product-pricing";

const product = {
  prices: {
    OMR: { minPrice: "1.000", maxPrice: "2.000", defaultPrice: "1.000" },
    USD: { minPrice: "3.000", maxPrice: "4.000", defaultPrice: "3.000" },
  },
};

test("product pricing resolves the selected currency instead of the first rule", () => {
  assert.deepEqual(priceBandForCurrency(product, "USD", "OMR"), product.prices.USD);
  assert.deepEqual(priceBandForCurrency(product, "AED", "OMR"), product.prices.OMR);
});

test("new-order UI carries all currency bands and reprices lines when currency changes", async () => {
  const page = await readFile(new URL("../app/salesman/new-order/page.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../app/salesman/new-order/NewInvoiceForm.tsx", import.meta.url), "utf8");
  assert.match(page, /prices:/);
  assert.match(form, /priceBandForCurrency/);
  assert.match(form, /changeCurrency\(event\.target\.value\)/);
  assert.doesNotMatch(form, /product\.defaultPrice/);
});
