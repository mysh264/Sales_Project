import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { priceRuleLockKeys } from "../lib/price-rule";

test("priceRuleLockKeys produces the two-key PostgreSQL advisory-lock shape without collisions", () => {
  const first = priceRuleLockKeys("branch-a", "product-a");
  const otherProduct = priceRuleLockKeys("branch-a", "product-b");
  const otherBranch = priceRuleLockKeys("branch-b", "product-a");

  assert.equal(first.length, 2);
  assert.notDeepEqual(first, otherProduct);
  assert.notDeepEqual(first, otherBranch);
});

test("price-rule create and edit mutations both acquire the shared lock", async () => {
  const source = await readFile(new URL("../app/actions/manager.ts", import.meta.url), "utf8");
  assert.equal(source.match(/priceRuleLockKeys\(/g)?.length, 2);
});
