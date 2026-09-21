import assert from "node:assert/strict";
import test from "node:test";
import { debtStatusWhere } from "../lib/debt-filter";

test("terminal debt statuses do not require a positive remaining balance", () => {
  assert.deepEqual(debtStatusWhere("PAID"), { status: "PAID" });
  assert.deepEqual(debtStatusWhere("WRITTEN_OFF"), { status: "WRITTEN_OFF" });
});

test("active and unknown debt filters retain the positive-balance guard", () => {
  assert.deepEqual(debtStatusWhere("OPEN"), { status: "OPEN", balanceAmount: { gt: 0 } });
  assert.deepEqual(debtStatusWhere("unknown"), {
    status: { in: ["OPEN", "PARTIALLY_PAID"] },
    balanceAmount: { gt: 0 },
  });
});
