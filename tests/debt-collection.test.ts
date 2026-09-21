import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../generated/prisma/client";
import { assertDebtCollectionAvailable } from "../lib/debt-collection";

test("assertDebtCollectionAvailable rejects collection above same-currency outstanding debt", () => {
  assert.throws(
    () => assertDebtCollectionAvailable(new Prisma.Decimal("10.001"), new Prisma.Decimal("10.000")),
    /cannot exceed the customer's outstanding debt in this currency/,
  );
});
