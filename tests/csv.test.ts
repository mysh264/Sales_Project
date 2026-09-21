import assert from "node:assert/strict";
import test from "node:test";
import { toCsvCell } from "../lib/csv";

test("CSV cells neutralize spreadsheet formulas from user-controlled strings", () => {
  assert.equal(toCsvCell("=HYPERLINK(\"https://example.test\")"), "\"'=HYPERLINK(\"\"https://example.test\"\")\"");
  assert.equal(toCsvCell(" +SUM(1,2)"), "\"' +SUM(1,2)\"");
  assert.equal(toCsvCell(-5), "-5");
});
