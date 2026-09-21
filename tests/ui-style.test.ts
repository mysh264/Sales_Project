import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("shared input placeholders use readable contrast", async () => {
  const source = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const inputRule = source.slice(source.indexOf(".ui-input"), source.indexOf(".ui-label"));
  assert.match(inputRule, /placeholder:text-slate-500/);
});

test("globals define secondary button and teal brand variables", async () => {
  const source = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /\.ui-btn-secondary/);
  assert.match(source, /--brand:\s*#0d9488/);
  assert.match(source, /--primary:/);
});

test("shadcn foundation files and utils exist", async () => {
  const utils = await readFile(new URL("../lib/utils.ts", import.meta.url), "utf8");
  const button = await readFile(new URL("../components/ui/shadcn-button.tsx", import.meta.url), "utf8");
  const dialog = await readFile(new URL("../components/ui/dialog.tsx", import.meta.url), "utf8");
  assert.match(utils, /export function cn/);
  assert.match(button, /shadcnButtonVariants/);
  assert.match(dialog, /DialogPrimitive/);
});

test("presentation link no longer uses indigo/violet gradient", async () => {
  const source = await readFile(new URL("../components/PresentationLink.tsx", import.meta.url), "utf8");
  assert.match(source, /bg-brand-gradient/);
  assert.doesNotMatch(source, /indigo-600|violet-600|fuchsia-600/);
});
