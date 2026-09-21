import assert from "node:assert/strict";
import test from "node:test";
import { loadAfterLock } from "../lib/debt-lock";

test("loadAfterLock acquires the debt lock before reading mutable balance", async () => {
  const calls: string[] = [];

  const result = await loadAfterLock(
    async () => { calls.push("lock"); },
    async () => { calls.push("load"); return "fresh debt"; },
  );

  assert.deepEqual(calls, ["lock", "load"]);
  assert.equal(result, "fresh debt");
});
