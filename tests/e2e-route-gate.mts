// Deterministic UI route-permission test: exercises the EXACT function the
// Next.js middleware uses to gate every page (allowedForPath in lib/auth.ts).
// This is the authoritative UI route-access contract (no flaky browser cookies).
import { register } from "node:module";
register("/tmp/stub-loader.mjs", import.meta.url);
const { allowedForPath, roleHome, protectedPrefixes } = await import("@/lib/auth");
const { DEFAULT_ROLE_PERMISSIONS } = await import("@/lib/permissions");

const ROLES = ["ADMIN", "GENERAL_MANAGER", "MANAGER", "LOADER", "SALESMAN"];
function perms(role) { return DEFAULT_ROLE_PERMISSIONS[role] ?? []; }

// Every mapped route prefix; build representative paths (base + /sub).
const PREFIXES = protectedPrefixes;
const paths = [];
for (const p of PREFIXES) { paths.push(p); paths.push(p + "/x"); }
// also add some un-mapped role areas that must be default-denied
const extraDenied = ["/admin-console", "/admin-console/x", "/unknown", "/weird/path", "/admin/secret"];

const results = [];
function scen(role, path, expect) { results.push({ role, path, expect, got: allowedForPath(role, path, perms(role)) }); }

// Build expected allow/deny from the route map directly (source of truth).
const { routePermissionMap } = await import("@/lib/auth").then((m) => m);
function expectedAllowed(role, path) {
  if (path === "/") return true;
  if (path.startsWith("/api")) return true;
  if (role === "ADMIN") return true;
  if (path.startsWith("/admin-console")) return false;
  if (path === "/profile" || path.startsWith("/profile/")) return true;
  const m = routePermissionMap.find(({ prefix }) => path === prefix || path.startsWith(prefix + "/"));
  if (!m) return false;
  const granted = new Set(perms(role));
  return m.permissions.some((p) => granted.has(p));
}

for (const role of ROLES) {
  for (const p of [...PREFIXES, ...extraDenied]) {
    for (const path of [p, p + "/sub"]) {
      scen(role, path, expectedAllowed(role, path));
    }
  }
}
// homepage redirect check
for (const role of ROLES) {
  results.push({ role, path: "/", expect: true, got: allowedForPath(role, "/", perms(role)), note: `home->${roleHome[role]}` });
}

const fails = results.filter((r) => r.got !== r.expect);
console.log(`ROUTE GATE MATRIX: ${results.length - fails.length}/${results.length} passed`);
for (const f of fails) console.log(`  FAIL ${String(f.role).padEnd(14)} ${String(f.path).padEnd(40)} expected=${f.expect} got=${f.got}`);
process.exit(fails.length ? 1 : 0);
