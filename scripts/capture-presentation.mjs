#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(root, "scripts/presentation-routes.json"), "utf8"));
const baseURL = process.env.PRESENTATION_BASE_URL ?? "https://sales.mahmoudbox.com";
const container = process.env.PRESENTATION_WEB_CONTAINER ?? "sales_nextjs";
const hostname = new URL(baseURL).hostname;

const tokenProgram = String.raw`
import pg from "pg";
import { SignJWT } from "jose";
const role = process.argv[1];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const result = await db.query(
    'SELECT u.id, u.role::text AS role, u."branchId", u."sessionVersion", r.permissions FROM "User" u LEFT JOIN "Role" r ON r.name = u.role::text WHERE u."isTestUser" = true AND u."isActive" = true AND u.role::text = $1 ORDER BY u."branchId" NULLS FIRST, u."createdAt" ASC LIMIT 1',
    [role],
  );
  if (result.rowCount !== 1) throw new Error('No active canonical test user for role ' + role);
  const user = result.rows[0];
  const secretText = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!secretText || secretText.length < 32) throw new Error('JWT secret is unavailable');
  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    sessionVersion: user.sessionVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(new TextEncoder().encode(secretText));
  process.stdout.write(token);
} finally {
  await db.end();
}
`;

const tokenCache = new Map();
function tokenForRole(role) {
  if (!tokenCache.has(role)) {
    const token = execFileSync(
      "docker",
      ["exec", container, "node", "--input-type=module", "-e", tokenProgram, role],
      { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "inherit"] },
    ).trim();
    if (!token) throw new Error(`Container returned no session for ${role}`);
    tokenCache.set(role, token);
  }
  return tokenCache.get(role);
}

async function captureSet(browser, items, mode) {
  const mobile = mode === "mobile";
  const outputDir = resolve(root, `present/${mode}`);
  await mkdir(outputDir, { recursive: true });

  for (const item of items) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 938 },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
      locale: "en-OM",
      timezoneId: "Asia/Muscat",
    });
    try {
      if (item.role) {
        await context.addCookies([
          {
            name: "sales_session",
            value: tokenForRole(item.role),
            domain: hostname,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
            expires: Math.floor(Date.now() / 1000) + 1_800,
          },
        ]);
      }

      const page = await context.newPage();
      const response = await page.goto(new URL(item.path, baseURL).toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      if (!response || response.status() !== 200) {
        throw new Error(`${item.path} returned ${response?.status() ?? "no response"}`);
      }
      const finalPath = new URL(page.url()).pathname;
      if (item.role && (finalPath === "/login" || finalPath.startsWith("/tester"))) {
        throw new Error(`${item.path} redirected to ${finalPath}`);
      }
      await page.addStyleTag({
        content: "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}",
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: resolve(outputDir, item.file), fullPage: false });
      console.log(`[presentation] ${mode} ${item.file} <- ${finalPath}`);
    } finally {
      await context.close();
    }
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await captureSet(browser, manifest.desktop, "desktop");
  await captureSet(browser, manifest.mobile, "mobile");
} finally {
  await browser.close();
}
