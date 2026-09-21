import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRouteReturn,
  canHandleReconciliationBranch,
  canReplaceMorningLoad,
  parseCylinderQuantity,
} from "../lib/reconciliation";

test("canReplaceMorningLoad blocks changing a route after sales were issued", () => {
  assert.equal(canReplaceMorningLoad({ status: "MORNING_RECORDED", invoiceCount: 1 }), false);
  assert.equal(canReplaceMorningLoad({ status: "MORNING_RECORDED", invoiceCount: 0 }), true);
});

test("parseCylinderQuantity rejects fractional counts instead of silently truncating them", () => {
  assert.throws(() => parseCylinderQuantity("1.5"), /whole number of zero or more/);
});

test("historical empty-cylinder collections do not exceed the morning full-load cap", () => {
  assert.deepEqual(
    calculateRouteReturn({ morningFull: 5, eveningReturnedFull: 4, eveningReturnedEmpty: 3 }),
    { soldFull: 1, missingEmpty: 0 },
  );
});

test("reconciliation authorization follows the recorded branch", () => {
  assert.equal(
    canHandleReconciliationBranch({ role: "LOADER", branchId: "branch-a", hasGlobalAccess: false }, "branch-a"),
    true,
  );
  assert.equal(
    canHandleReconciliationBranch({ role: "LOADER", branchId: "branch-b", hasGlobalAccess: false }, "branch-a"),
    false,
  );
});
