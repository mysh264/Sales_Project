import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("design tokens use industrial teal brand instead of indigo/violet", async () => {
  const tw = await readFile(new URL("../tailwind.config.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(tw, /#0f766e|#0d9488/);
  assert.doesNotMatch(tw, /#4f46e5|#7c3aed/);
  assert.match(css, /--brand:\s*#0d9488/);
  assert.match(css, /\.ui-btn-secondary/);
});

test("TopNav provides a mobile drawer control", async () => {
  const source = await readFile(new URL("../components/ui/TopNav.tsx", import.meta.url), "utf8");
  assert.match(source, /mobile-nav-drawer/);
  assert.match(source, /md:hidden/);
  assert.match(source, /hidden flex-1 flex-wrap items-center gap-1\.5 md:flex/);
});

test("new-order product rows do not force a 760px horizontal min-width", async () => {
  const source = await readFile(new URL("../app/salesman/new-order/NewInvoiceForm.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /min-w-\[760px\]/);
  assert.match(source, /Currency is locked while this customer has credit or open debt/);
});

test("field layouts no longer hard-code purple admin console accents", async () => {
  for (const rel of [
    "../app/salesman/layout.tsx",
    "../app/loader/layout.tsx",
    "../app/logistics/layout.tsx",
  ]) {
    const source = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(source, /bg-purple-600/);
  }
});

test("dev CSP allows unsafe-eval so Next.js client login can hydrate", async () => {
  const source = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(source, /unsafe-eval/);
  assert.match(source, /NODE_ENV === "production"/);
});

test("role layouts expose LocaleToggle and translated nav brands", async () => {
  for (const rel of [
    "../app/manager/layout.tsx",
    "../app/admin/layout.tsx",
    "../app/finance/layout.tsx",
    "../app/loader/layout.tsx",
  ]) {
    const source = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.match(source, /LocaleToggle/);
    assert.match(source, /readLocale/);
  }
});

test("role segments provide loading and error shells", async () => {
  for (const role of ["manager", "loader", "finance", "admin", "general-manager", "logistics"]) {
    const loading = await readFile(new URL(`../app/${role}/loading.tsx`, import.meta.url), "utf8");
    const error = await readFile(new URL(`../app/${role}/error.tsx`, import.meta.url), "utf8");
    assert.match(loading, /RoleLoading|Skeleton|Loading/);
    assert.match(error, /RoleError|reset/);
  }
});
