import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../generated/prisma/client";
import { debtCollectionsByCurrency } from "../lib/finance";

test("debtCollectionsByCurrency keeps manager and sales collections in their invoice currency", () => {
  assert.deepEqual(
    debtCollectionsByCurrency([
      { currency: "OMR", amount: new Prisma.Decimal("5.250") },
      { currency: "USD", amount: new Prisma.Decimal("2.000") },
      { currency: "OMR", amount: new Prisma.Decimal("0.750") },
    ]),
    { OMR: "6.000", USD: "2.000" },
  );
});
