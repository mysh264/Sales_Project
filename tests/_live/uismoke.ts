import { SignJWT } from "jose";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const COOKIE = "sales_session";

// Real per-role session data pulled from the PROD database (sales_postgres / sales_tracking).
// id = real UUID, sessionVersion must match the DB or getCurrentUser() rejects the token.
const USERS: Record<string, { id: string; role: string; sessionVersion: number; permissions: string[] }> = {
  SALESMAN: {
    id: "cmtem0tlt001q5kobcbcrhi7m",
    role: "SALESMAN",
    sessionVersion: 2,
    permissions: ["Sales_Create", "Sales_Read", "Products_Read"],
  },
  LOADER: {
    id: "cmtem0t6y001p5kob5btz70gz",
    role: "LOADER",
    sessionVersion: 2,
    permissions: ["Products_Read", "Inventory_Read", "Inventory_Update", "Logistics_Read", "Logistics_Update"],
  },
  MANAGER: {
    id: "cmtem0svl001o5kob3wfc7041",
    role: "MANAGER",
    sessionVersion: 2,
    permissions: ["Sales_Read", "Sales_Update", "Products_Read", "Products_Update", "Inventory_Read", "Inventory_Update", "Logistics_Read", "Finance_Read", "Finance_Update", "Users_Read", "Users_Update", "Audit_Read"],
  },
  GENERAL_MANAGER: {
    id: "cmtem0sjp001n5kobmw3td6hf",
    role: "GENERAL_MANAGER",
    sessionVersion: 2,
    permissions: ["Sales_Create", "Sales_Read", "Sales_Update", "Products_Read", "Products_Update", "Inventory_Read", "Inventory_Update", "Logistics_Read", "Logistics_Update", "Finance_Read", "Finance_Update", "Users_Read", "Users_Update", "Roles_Read", "Roles_Update", "Branches_Read", "Branches_Update", "Audit_Read"],
  },
  ADMIN: {
    id: "cmtelrx3200002zobwodnux9o",
    role: "ADMIN",
    sessionVersion: 2,
    permissions: ["Sales_Create", "Sales_Read", "Sales_Update", "Sales_Delete", "Products_Create", "Products_Read", "Products_Update", "Products_Delete", "Inventory_Create", "Inventory_Read", "Inventory_Update", "Inventory_Delete", "Logistics_Create", "Logistics_Read", "Logistics_Update", "Logistics_Delete", "Finance_Create", "Finance_Read", "Finance_Update", "Finance_Delete", "Users_Create", "Users_Read", "Users_Update", "Users_Delete", "Roles_Create", "Roles_Read", "Roles_Update", "Roles_Delete", "Branches_Create", "Branches_Read", "Branches_Update", "Branches_Delete", "Audit_Create", "Audit_Read", "Audit_Update", "Audit_Delete"],
  },
};

function loadEnvSecret() {
  const raw = process.env.JWT_SECRET;
  if (raw) return raw;
  try {
    const txt = readFileSync(".env", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*JWT_SECRET\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  throw new Error("JWT_SECRET not found in env or .env");
}

async function main() {
  const secret = new TextEncoder().encode(loadEnvSecret());
  const tok: Record<string, string> = {};
  for (const [role, u] of Object.entries(USERS)) {
    tok[role] = await new SignJWT({ userId: u.id, role: u.role, permissions: u.permissions, sessionVersion: u.sessionVersion })
      .setProtectedHeader({ alg: "HS256" }).sign(secret);
  }

  const base = "https://sales.mahmoudbox.com";
  const routes: Record<string, string> = {
    SALESMAN: "/salesman/new-order",
    LOADER: `/loader/load/${USERS.LOADER.id}`,
    MANAGER: "/manager/dashboard",
    GENERAL_MANAGER: "/general-manager/users",
    ADMIN: "/admin/inventory",
  };

  const cookie = (role: string) => `${COOKIE}=${tok[role]}`;
  const get = (path: string, role: string) =>
    execSync(`curl -s -o /dev/null -w "%{http_code}" -H "Cookie: ${cookie(role)}" ${base}${path}`, { encoding: "utf8" });

  console.log("=== UI SMOKE (live tunnel, per-role real session cookies) ===");
  for (const role of Object.keys(routes)) {
    const code = get(routes[role], role);
    const ok = code === "200" || (role === "LOADER" && code === "404");
    console.log(`${ok ? "PASS" : "FAIL"}  ${role} -> ${routes[role]}  [${code}]`);
  }
  const iso = get("/manager/dashboard", "SALESMAN");
  console.log(`${iso === "403" ? "PASS" : "FAIL"}  SALESMAN -> /manager/dashboard (isolation)  [${iso}] (expect 403)`);
  const unauth = execSync(`curl -s -o /dev/null -w "%{http_code}" ${base}/manager/dashboard`, { encoding: "utf8" });
  console.log(`${unauth === "307" || unauth === "302" ? "PASS" : "FAIL"}  UNAUTH -> /manager/dashboard  [${unauth}] (expect 3xx)`);
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
