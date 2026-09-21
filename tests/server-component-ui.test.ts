import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("customer statements delegate browser printing to a client component", async () => {
  const source = await readFile(new URL("../app/finance/statements/[customerId]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /<PrintButton\s*\/>/);
  assert.doesNotMatch(source, /onClick=\{\(\) => window\.print\(\)\}/);
});
