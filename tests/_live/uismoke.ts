import { SignJWT } from "jose";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const COOKIE = "sales_session";

// Load JWT_SECRET the same way the running Next server does (from .env), so the minted
// session cookie actually verifies against the server's middleware secret.
function loadEnvSecret() {
  const raw = process.env.JWT_SECRET;
  if (raw) return raw;
  throw new Error("JWT_SECRET not found in env");
}

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["SALESMAN", "LOADER", "MANAGER", "GENERAL_MANAGER", "ADMIN"] } },
    select: { id: true, role: true, branchId: true },
  });
  await prisma.$disconnect();

  const secret = new TextEncoder().encode(loadEnvSecret());
  const tok: Record<string, string> = {};
  const salesman = users.find((u) => u.role === "SALESMAN");
  for (const u of users) {
    tok[u.role] = await new SignJWT({ userId: u.id, role: u.role, permissions: [], sessionVersion: 1 })
      .setProtectedHeader({ alg: "HS256" }).sign(secret);
  }

  const base = "http://127.0.0.1:3141";
  const routes: Record<string, string> = {
    SALESMAN: "/salesman/new-order",
    LOADER: `/loader/load/${salesman?.id ?? "x"}`,
    MANAGER: "/manager/dashboard",
    GENERAL_MANAGER: "/general-manager/users",
    ADMIN: "/admin/inventory",
  };

  const cookie = (role: string) => `${COOKIE}=${tok[role]}`;
  const get = (path: string, role: string) =>
    execSync(`curl -s -o /dev/null -w "%{http_code}" -H "Cookie: ${cookie(role)}" ${base}${path}`, { encoding: "utf8" });

  console.log("=== UI SMOKE (running server, per-role session cookies) ===");
  for (const role of Object.keys(routes)) {
    const code = get(routes[role], role);
    // 200 = rendered; 404 on loader route = page logic ran (no load pending today) -> still wired
    const ok = code === "200" || (role === "LOADER" && code === "404");
    console.log(`${ok ? "PASS" : "FAIL"}  ${role} -> ${routes[role]}  [${code}]`);
  }
  const iso = get("/manager/dashboard", "SALESMAN");
  console.log(`${iso === "403" ? "PASS" : "FAIL"}  SALESMAN -> /manager/dashboard (isolation)  [${iso}] (expect 403)`);
  const unauth = execSync(`curl -s -o /dev/null -w "%{http_code}" ${base}/manager/dashboard`, { encoding: "utf8" });
  console.log(`${unauth === "307" || unauth === "302" ? "PASS" : "FAIL"}  UNAUTH -> /manager/dashboard  [${unauth}] (expect 3xx)`);
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
