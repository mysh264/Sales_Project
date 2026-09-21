import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("presentation capture manifest covers every committed desktop and mobile screenshot", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../scripts/presentation-routes.json", import.meta.url), "utf8"),
  ) as { desktop: unknown[]; mobile: unknown[] };
  assert.equal(manifest.desktop.length, 32);
  assert.equal(manifest.mobile.length, 16);
});

test("presentation capture script rejects non-application responses and never logs session tokens", async () => {
  const source = await readFile(new URL("../scripts/capture-presentation.mjs", import.meta.url), "utf8");
  assert.match(source, /response\.status\(\) !== 200/);
  assert.doesNotMatch(source, /console\.log\([^\n]*token/i);
});

test("presentation README documents the capture command that actually exists", async () => {
  const source = await readFile(new URL("../present/README.md", import.meta.url), "utf8");
  assert.match(source, /node scripts\/capture-presentation\.mjs/);
  assert.doesNotMatch(source, /prescan\.sh/);
});
