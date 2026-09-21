import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("writeOffDebt records settlement separately from real customer payments", async () => {
  const source = await readFile(new URL("../app/actions/manager.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function writeOffDebt");
  const end = source.indexOf("export async function getDebtDetails", start);
  const writeOffSource = source.slice(start, end);

  assert.match(writeOffSource, /writtenOffAmount:\s*\{\s*increment:\s*writtenOffAmount\s*\}/);
  assert.doesNotMatch(writeOffSource, /paidAmount:\s*\{\s*increment:\s*writtenOffAmount\s*\}/);
});
