import assert from "node:assert/strict";
import test from "node:test";
import { toggledState } from "../lib/toggle-state";

test("toggledState derives the next value from authoritative server state", () => {
  assert.equal(toggledState(true), false);
  assert.equal(toggledState(false), true);
});
