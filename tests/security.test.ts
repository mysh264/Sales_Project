import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { verifyPasswordStepUp } from "../lib/security";

test("verifyPasswordStepUp rejects a wrong current password", async () => {
  const hash = await bcrypt.hash("correct-password", 4);
  assert.equal(await verifyPasswordStepUp("wrong-password", hash), false);
});
