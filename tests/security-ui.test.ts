import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("recovery-code regeneration asks for the current password", async () => {
  const source = await readFile(new URL("../app/profile/security/RecoveryCodes.tsx", import.meta.url), "utf8");
  assert.match(source, /name="password"/);
});

test("first-time MFA setup asks for the current password", async () => {
  const page = await readFile(new URL("../app/profile/security/page.tsx", import.meta.url), "utf8");
  const action = await readFile(new URL("../app/actions/security.ts", import.meta.url), "utf8");
  assert.match(page, /action=\{beginMfaSetup\}[\s\S]*name="password"/);
  assert.match(action, /beginMfaSetup[\s\S]*verifyPasswordStepUp\(password, user\.passwordHash\)/);
  assert.doesNotMatch(action, /if \(user\.mfaEnabled\)[\s\S]*verifyPasswordStepUp/);
});
