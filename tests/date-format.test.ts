import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateDMY,
  formatDateTimeDMY,
  formatIsoDateDMY,
  parseDmyDateToIso,
} from "../lib/date-format";

test("dates are displayed day-first in Oman time", () => {
  const lateUtc = new Date("2026-07-23T21:05:00.000Z");

  assert.equal(formatDateDMY(lateUtc), "24/07/2026");
  assert.equal(formatDateTimeDMY(lateUtc), "24/07/2026 01:05");
});

test("Oman date inputs convert safely between display and submission formats", () => {
  assert.equal(formatIsoDateDMY("2026-07-27"), "27/07/2026");
  assert.equal(parseDmyDateToIso("27/07/2026"), "2026-07-27");
  assert.equal(parseDmyDateToIso("31/02/2026"), "");
  assert.equal(parseDmyDateToIso("07/27/2026"), "");
});
