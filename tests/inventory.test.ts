import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("manual inventory adjustments lock the balance row and apply atomic deltas", async () => {
  const source = await readFile(new URL("../app/actions/inventory.ts", import.meta.url), "utf8");
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /fullCount: \{ increment: fullDelta \}/);
  assert.match(source, /emptyCount: \{ increment: emptyDelta \}/);
  assert.doesNotMatch(source, /fullCount: nextFull/);
});
