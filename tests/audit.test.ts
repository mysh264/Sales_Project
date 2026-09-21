import assert from "node:assert/strict";
import test from "node:test";
import { auditSnapshot, resolveAuditIdentity } from "../lib/audit";

test("auditSnapshot recursively redacts authentication material", () => {
  assert.deepEqual(
    auditSnapshot({
      email: "safe@example.test",
      passwordHash: "password-hash",
      mfaSecret: "totp-secret",
      mfaRecoveryCodes: ["recovery-hash"],
      nested: { statementTokenHash: "statement-token-hash" },
    }),
    {
      email: "safe@example.test",
      passwordHash: "[REDACTED]",
      mfaSecret: "[REDACTED]",
      mfaRecoveryCodes: "[REDACTED]",
      nested: { statementTokenHash: "[REDACTED]" },
    },
  );
});

test("resolveAuditIdentity attributes impersonated work to both tester and target", () => {
  assert.deepEqual(
    resolveAuditIdentity({
      submittedUserId: "target-user",
      sessionUserId: "target-user",
      impersonatorId: "master-tester",
    }),
    { actorUserId: "master-tester", effectiveUserId: "target-user" },
  );
});
