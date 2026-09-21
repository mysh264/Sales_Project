import assert from "node:assert/strict";
import test from "node:test";
import { htmlDir, htmlLang, normalizeLocale, t } from "@/lib/i18n";
import { readFile } from "node:fs/promises";

test("locale helpers flip lang and dir for Arabic", () => {
  assert.equal(normalizeLocale("ar"), "ar");
  assert.equal(htmlLang("ar"), "ar-OM");
  assert.equal(htmlDir("ar"), "rtl");
  assert.equal(t("ar", "newOrder"), "طلب جديد");
  assert.equal(htmlDir("en"), "ltr");
});

test("root layout reads locale cookie for html dir", async () => {
  const source = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /dir=\{htmlDir\(locale\)\}/);
  assert.match(source, /LOCALE_COOKIE/);
});

test("new invoice customer search exposes combobox a11y attributes", async () => {
  const source = await readFile(new URL("../app/salesman/new-order/NewInvoiceForm.tsx", import.meta.url), "utf8");
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-expanded=\{showCustomerPicker\}/);
  assert.match(source, /aria-controls="customer-search-results"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /aria-live="polite"/);
});
