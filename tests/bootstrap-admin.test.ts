import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { bootstrapPasswordNeedsSync } from "../lib/bootstrap-admin";

test("bootstrapPasswordNeedsSync keeps an existing hash for the same password", async () => {
  const existingHash = await bcrypt.hash("correct horse battery staple", 4);

  assert.equal(await bootstrapPasswordNeedsSync("correct horse battery staple", existingHash), false);
});

test("bootstrapPasswordNeedsSync requires a hash when an account has no password", async () => {
  assert.equal(await bootstrapPasswordNeedsSync("correct horse battery staple", null), true);
});
