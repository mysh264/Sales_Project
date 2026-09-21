import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeTestIdentity, requireTestPassword } from "../lib/test-user-seed";

test("assertSafeTestIdentity refuses to convert a real account into a test identity", () => {
  assert.throws(
    () => assertSafeTestIdentity({ isTestUser: false }, "human@example.test"),
    /Refusing to overwrite a non-test account/,
  );
});

test("requireTestPassword rejects an enabled tester feature without an explicit password", () => {
  assert.throws(
    () => requireTestPassword(true, undefined, "MASTERTESTER_PASSWORD"),
    /MASTERTESTER_PASSWORD must be set to at least 12 characters/,
  );
});
