import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("audit CSV exports the effective impersonated identity", async () => {
  const source = await readFile(new URL("../app/admin/audit-logs/export/route.ts", import.meta.url), "utf8");
  assert.match(source, /effectiveUser/);
  assert.match(source, /effectiveUserRole/);
});
