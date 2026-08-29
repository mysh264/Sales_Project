import { expect, test } from "@playwright/test";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";

async function login(page: import("@playwright/test").Page, email: string, password: string, path: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
}

test("all consolidated account types reach the correct dashboard", async ({ browser }) => {
  const accounts = [
    ["admin@mahmoudbox.com", adminPassword, "/admin"],
    ["gm@test.local", demoPassword, "/general-manager"],
    ["manager@test.local", demoPassword, "/manager"],
    ["loader@test.local", demoPassword, "/loader"],
    ["salesman@test.local", demoPassword, "/salesman"],
  ] as const;

  for (const [email, password, path] of accounts) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, email, password, path);
    await context.close();
  }
});

test("manager has consolidated finance and branch user management but cannot create sales", async ({ page }) => {
  await login(page, "manager@test.local", demoPassword, "/manager");
  await page.getByRole("link", { name: "Finance & Debts" }).click();
  await expect(page.getByRole("heading", { name: /Financial Overview/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Team" })).toBeVisible();

  await page.getByRole("link", { name: "Sales", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Sales" })).toBeVisible();

  await page.getByRole("link", { name: "Reconciliation" }).click();
  await expect(page.getByRole("heading", { name: "Loader to Invoice Hand-off" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Test Salesman", exact: true })).toBeAttached();

  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page.getByRole("heading", { name: "Inventory Adjustments" })).toBeVisible();

  await page.getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: "Price Management" })).toBeVisible();

  await page.getByRole("link", { name: "Team" }).click();
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(page.getByText("Test Loader", { exact: true })).toBeVisible();
  await expect(page.getByText("Test Salesman", { exact: true })).toBeVisible();
  await expect(page.getByText("Managed centrally", { exact: true }).first()).toBeVisible();

  const response = await page.goto("/salesman/new-order");
  expect(response?.status()).toBe(403);
  const loaderMutation = await page.goto("/loader/load/demo-user");
  expect(loaderMutation?.status()).toBe(403);
});

test("human-facing account dashboards expose their primary work", async ({ browser }) => {
  const checks = [
    {
      email: "gm@test.local",
      password: demoPassword,
      path: "/general-manager",
      visible: /Global Overview/,
    },
    {
      email: "loader@test.local",
      password: demoPassword,
      path: "/loader",
      visible: /Daily Route Dashboard/,
    },
    {
      email: "salesman@test.local",
      password: demoPassword,
      path: "/salesman",
      visible: /Welcome, Test Salesman/,
    },
  ] as const;

  for (const check of checks) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, check.email, check.password, check.path);
    await expect(page.getByRole("heading", { name: check.visible })).toBeVisible();
    await expect(page.getByRole("link", { name: "Security" })).toBeVisible();
    await context.close();
  }
});

test("general manager can reach every global operation from visible navigation", async ({ page }) => {
  await login(page, "gm@test.local", demoPassword, "/general-manager");
  const destinations = [
    ["Finance", /Financial Overview/],
    ["Reconciliation", /Loader to Invoice Hand-off/],
    ["Users", /User Management/],
    ["Branches", /Branch Configuration/],
    ["Products", /Product Master Data/],
    ["Inventory", /Inventory Adjustments/],
    ["Roles", /Role Management/],
  ] as const;

  for (const [linkName, heading] of destinations) {
    await page.getByRole("link", { name: linkName, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});
