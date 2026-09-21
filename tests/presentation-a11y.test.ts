import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("presentation navigation exposes active-slide and explicit control semantics", async () => {
  const source = await readFile(new URL("../present/index.html", import.meta.url), "utf8");
  assert.match(source, /aria-label="Previous slide"/);
  assert.match(source, /aria-label="Next slide"/);
  assert.match(source, /aria-current/);
  assert.match(source, /aria-hidden/);
  assert.match(source, /toggleAttribute\('inert'/);
});

test("presentation reports the currently verified user, route, and regression totals", async () => {
  const source = await readFile(new URL("../present/index.html", import.meta.url), "utf8");
  assert.match(source, />28<\/div>/);
  assert.match(source, /474 \/ 474/);
  assert.match(source, /100 \/ 100/);
  assert.doesNotMatch(source, /385 \/ 385|44 E2E tests|9 users/);
});
