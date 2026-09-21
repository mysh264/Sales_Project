import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("production CSP stays strict without unsafe-eval", async () => {
  const source = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(source, /NODE_ENV === "production"/);
  const productionBranch = source.slice(
    source.indexOf('process.env.NODE_ENV === "production"'),
    source.indexOf(": \"script-src"),
  );
  assert.match(productionBranch, /script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(productionBranch, /unsafe-eval/);
});

test("middleware honors APP_ORIGIN for auth redirects", async () => {
  const source = await readFile(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(source, /process\.env\.APP_ORIGIN/);
  assert.match(source, /redirectPath/);
});

test("docker compose and standalone output are configured for deploy", async () => {
  const compose = await readFile(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(compose, /postgres:16/);
  assert.match(nextConfig, /output:\s*"standalone"/);
});
