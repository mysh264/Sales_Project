import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("all-sales KPIs aggregate the full filtered period instead of the latest 50 rows", async () => {
  const source = await readFile(new URL("../app/manager/all-sales/page.tsx", import.meta.url), "utf8");
  assert.match(source, /prisma\.invoice\.groupBy/);
  assert.doesNotMatch(source, /monthlyRevenue\s*=\s*invoices\.reduce/);
});

test("all-sales ledger paginates instead of a hard 50-row ceiling", async () => {
  const source = await readFile(new URL("../app/manager/all-sales/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const pageSize = 50/);
  assert.match(source, /skip,/);
  assert.match(source, /prisma\.invoice\.count/);
  assert.match(source, /Page \{page\} \/ \{totalPages\}/);
});
