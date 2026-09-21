import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("tester logout is rendered before the long impersonation target list", async () => {
  const source = await readFile(new URL("../app/tester/page.tsx", import.meta.url), "utf8");
  const logoutPosition = source.indexOf("form action={logout}");
  const targetListPosition = source.indexOf("{targets.length === 0");

  assert.ok(logoutPosition >= 0, "tester page must render a logout form");
  assert.ok(logoutPosition < targetListPosition, "logout must be visible above the target list");
});
