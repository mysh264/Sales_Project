import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("maintenance waits for the migrated web service to become healthy", async () => {
  const source = await readFile(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const maintenance = source.slice(source.indexOf("  maintenance:"), source.indexOf("  backup:"));
  assert.match(maintenance, /depends_on:\s*\n\s+web:\s*\n\s+condition: service_healthy/);
});

test("backup service archives database dumps and the uploads volume", async () => {
  const source = await readFile(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const backup = source.slice(source.indexOf("  backup:"));
  assert.match(backup, /uploads_data:\/uploads:ro/);
  assert.match(backup, /uploads-\$\$stamp\.tar\.gz/);
});
