import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sumFullQuantitiesByProduct } from "../lib/invoice-lines";

test("duplicate invoice rows are aggregated for stock validation", () => {
  assert.deepEqual(
    [...sumFullQuantitiesByProduct([
      { productId: "oxygen", fullQty: 3 },
      { productId: "oxygen", fullQty: 4 },
      { productId: "argon", fullQty: 2 },
    ])],
    [["oxygen", 7], ["argon", 2]],
  );
});

test("createOrder uses the aggregated delivered quantity at the stock gate", async () => {
  const source = await readFile(new URL("../app/actions/sales.ts", import.meta.url), "utf8");
  assert.match(source, /sumFullQuantitiesByProduct\(lines\)/);
});
