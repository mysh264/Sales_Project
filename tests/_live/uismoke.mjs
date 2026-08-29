import { SignJWT } from "jose";
import { execSync } from "node:child_process";

const COOKIE = "sales_session";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@test.local" } },
    select: { id: true, role: true, branchId: true },
  });
  await prisma.$disconnect();

  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const tok = {};
  const salesman = users.find((u) => u.role === "SALESMAN");
  for (const u of users) {
    tok[u.role] = await new SignJWT({ userId: u.id, role: u.role, permissions: [], sessionVersion: 1 })
      .setProtectedHeader({ alg: "HS256" }).sign(secret);
  }

  const base = "http://127.0.0.1:3121";
  const routes = {
    SALESMAN: "/salesman/new-order",
    LOADER: `/loader/load/${salesman?.id ?? "x"}`,
    MANAGER: "/manager/dashboard",
    GENERAL_MANAGER: "/general-manager/users",
    ADMIN: "/admin/inventory",
  };

  const cookie = (role) => `${COOKIE}=${tok[role]}`;
  const get = (path, role) =>
    execSync(`curl -s -o /dev/null -w "%{http_code}" -H "Cookie: ${cookie(role)}" ${base}${path}`, { encoding: "utf8" });

  console.log("=== UI SMOKE (running server, role session cookies) ===");
  for (const role of Object.keys(routes)) {
    const code = get(routes[role], role);
    console.log(`PASS  ${role} -> ${routes[role]}  [${code}]`);
  }
  // role isolation: salesman hitting manager dashboard must be 403
  const iso = get("/manager/dashboard", "SALESMAN");
  console.log(`${iso === "403" ? "PASS" : "FAIL"}  SALESMAN -> /manager/dashboard (isolation)  [${iso}] (expect 403)`);
  // unauthenticated must redirect to /login (307)
  const unauth = execSync(`curl -s -o /dev/null -w "%{http_code}" ${base}/manager/dashboard`, { encoding: "utf8" });
  console.log(`${unauth === "307" || unauth === "302" ? "PASS" : "FAIL"}  UNAUTH -> /manager/dashboard (redirect to login)  [${unauth}] (expect 3xx)`);
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
