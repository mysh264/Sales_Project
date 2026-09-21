import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("audit log UI identifies the impersonated effective user", async () => {
  const source = await readFile(new URL("../app/admin/audit-logs/AuditLogTable.tsx", import.meta.url), "utf8");
  assert.match(source, /effectiveUser/);
  assert.match(source, /Acting as/);
});
