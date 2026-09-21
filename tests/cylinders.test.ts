import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildCylinderEventData } from "../lib/cylinders";

test("cylinder events inherit the selected cylinder branch instead of the actor branch", () => {
  assert.deepEqual(
    buildCylinderEventData(
      { id: "cylinder-1", branchId: "branch-a" },
      { type: "DAILY_RETURN_FULL", status: "RETURNED", note: "Returned to warehouse" },
    ),
    {
      cylinderId: "cylinder-1",
      branchId: "branch-a",
      type: "DAILY_RETURN_FULL",
      status: "RETURNED",
      note: "Returned to warehouse",
    },
  );
});

test("cylinder registration commits the cylinder, initial event, and audits atomically", async () => {
  const source = await readFile(new URL("../app/admin/cylinders/actions.ts", import.meta.url), "utf8");
  const registerSource = source.split("export async function logCylinderEvent")[0];
  assert.match(registerSource, /prisma\.\$transaction/);
  assert.match(registerSource, /\{ tx \}/);
});
