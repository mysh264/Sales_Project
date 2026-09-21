import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { auditActionsForGroup } from "../lib/audit-action-groups";

test("audit action groups expand to every action represented by the UI filter", () => {
  assert.deepEqual(auditActionsForGroup("user_changes"), [
    "CREATE_USER",
    "UPDATE_PERMISSION",
    "UPDATE_USER_STATUS",
  ]);
  assert.deepEqual(auditActionsForGroup("unknown"), []);
});

test("audit CSV receives the selected action group instead of only its first action", async () => {
  const page = await readFile(new URL("../app/admin/audit-logs/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/admin/audit-logs/export/route.ts", import.meta.url), "utf8");
  assert.match(page, /actionGroup\s*\}/);
  assert.doesNotMatch(page, /action:\s*selectedGroup\.actions\[0\]/);
  assert.match(route, /auditActionsForGroup/);
  assert.match(route, /action:\s*\{\s*in:\s*actions\s*\}/);
});
