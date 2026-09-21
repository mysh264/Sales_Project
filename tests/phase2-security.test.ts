import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { hashStatementToken, mintStatementToken, statementTokenMatches } from "@/lib/statement-token";
import { detectUploadKind } from "@/lib/uploads";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { UserRole } from "@/generated/prisma/client";
import { Permissions } from "@/lib/permissions";

test("statement tokens are stored as sha256 hashes", () => {
  const { token, tokenHash } = mintStatementToken();
  assert.equal(tokenHash, createHash("sha256").update(token, "utf8").digest("hex"));
  assert.equal(hashStatementToken(token), tokenHash);
  assert.equal(statementTokenMatches(token, tokenHash), true);
  assert.equal(statementTokenMatches("wrong", tokenHash), false);
  assert.equal(statementTokenMatches(token, token), true);
});

test("upload magic-byte detection accepts pdf jpeg png", () => {
  assert.equal(detectUploadKind(Buffer.from("%PDF-1.4"))?.extension, ".pdf");
  assert.equal(detectUploadKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.extension, ".jpg");
  assert.equal(
    detectUploadKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension,
    ".png",
  );
  assert.equal(detectUploadKind(Buffer.from("not-a-file")), null);
});

test("manager defaults no longer include Sales_Update", () => {
  assert.equal(DEFAULT_ROLE_PERMISSIONS[UserRole.MANAGER].includes(Permissions.Sales_Update), false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS[UserRole.MANAGER].includes(Permissions.Finance_Update), true);
});
