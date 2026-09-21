import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("the Prisma config tree overrides the vulnerable deepmerge-ts release", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.overrides?.["deepmerge-ts"] ?? "", /^8\./);
});

test("the Next.js tree overrides the vulnerable PostCSS patch release", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.devDependencies?.postcss, "8.5.26");
  assert.equal(packageJson.overrides?.postcss, "$postcss");
});

test("dependency overrides preserve the existing security patch set", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  for (const dependency of ["brace-expansion", "find-my-way", "sharp", "valibot"]) {
    assert.ok(packageJson.overrides?.[dependency], `missing ${dependency} override`);
  }
});
