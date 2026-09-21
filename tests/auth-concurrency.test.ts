import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("failed-login counting uses one atomic database increment", async () => {
  const source = await readFile(new URL("../app/actions/auth.ts", import.meta.url), "utf8");
  assert.match(source, /"failedLoginAttempts" = "failedLoginAttempts" \+ 1/);
  assert.doesNotMatch(source, /user\.failedLoginAttempts \+ 1/);
});

test("recovery-code consumption uses compare-and-swap", async () => {
  const source = await readFile(new URL("../app/actions/auth.ts", import.meta.url), "utf8");
  assert.match(source, /mfaRecoveryCodes: user\.mfaRecoveryCodes/);
  assert.match(source, /sessionVersion: user\.sessionVersion/);
  assert.match(source, /consumed\.count === 1/);
});
