import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("role permission checkboxes do not auto-submit before the user saves the form", async () => {
  const source = await readFile(new URL("../app/admin/roles/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /autoSubmit=\{isEditMode\}/);
});
