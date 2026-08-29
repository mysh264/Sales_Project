import { expect, test } from "@playwright/test";

const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mahmoudbox.com");
  await page.getByLabel("Password", { exact: true }).fill(adminPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("admin completes system ownership workflow through one visible interface", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  const navigationChecks = [
    ["Users", /Admin Console/],
    ["Finance", /Financial Overview/],
    ["Sales", /All Sales/],
    ["Reconciliation", /Loader to Invoice Hand-off/],
    ["Audit Logs", /Audit Log Inspection/],
    ["Products", /Product Master Data/],
    ["Inventory", /Inventory Adjustments/],
    ["Roles", /Role Management/],
    ["Branches", /Branch Configuration/],
  ] as const;

  for (const [linkName, heading] of navigationChecks) {
    await page.getByRole("navigation").getByRole("link", { name: linkName, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Users", exact: true })).toBeVisible();
  }

  await page.getByRole("navigation").getByRole("link", { name: "Branches", exact: true }).click();
  await page.getByLabel("Name").fill("E2E Admin Branch");
  await page.getByLabel("Location").fill("Automated verification");
  await page.getByLabel("Code").fill("E2E_ADMIN");
  await page.getByRole("button", { name: "Create Branch" }).click();
  await expect(page.getByRole("row").filter({ hasText: "E2E Admin Branch" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Products", exact: true }).click();
  await page.getByLabel("SKU").fill("E2E-ADMIN-CYL");
  await page.getByLabel("Name").fill("E2E Admin Gas");
  await page.getByLabel("Gas Type").fill("Verification Gas");
  await page.getByLabel("Cylinder Size").fill("10L");
  await page.getByRole("button", { name: "Create Product" }).click();
  await expect(page.getByRole("row").filter({ hasText: "E2E Admin Gas" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Inventory", exact: true }).click();
  await page.getByLabel("Branch").selectOption({ label: "E2E Admin Branch" });
  await page.getByLabel("Product").selectOption({ label: "E2E Admin Gas · 10L" });
  await page.getByLabel("Full cylinder adjustment").fill("5");
  await page.getByPlaceholder("Reason for adjustment").fill("Admin browser verification");
  await page.getByRole("button", { name: "Record Audited Adjustment" }).click();
  const inventoryRow = page
    .getByRole("row")
    .filter({ hasText: "E2E Admin Branch" })
    .filter({ hasText: "E2E Admin Gas" });
  await expect(inventoryRow).toContainText("5");

  await page.getByRole("navigation").getByRole("link", { name: "Users", exact: true }).click();
  const currentAdminRow = page.getByRole("row").filter({ hasText: "admin@mahmoudbox.com" });
  await expect(currentAdminRow.getByText("Current Account")).toBeVisible();
  await expect(currentAdminRow.getByText("Protected Admin")).toBeVisible();
  await expect(currentAdminRow.getByRole("button", { name: "Deactivate" })).toHaveCount(0);

  await page.getByLabel("Full Name").fill("E2E Admin Loader");
  await page.getByLabel("Email").fill("e2e-admin-loader@test.local");
  await page.getByLabel("Password").fill("E2EAdminLoader123!");
  await page.getByLabel("Role").selectOption("LOADER");
  await page.getByLabel("Branch").selectOption({ label: "E2E_ADMIN · E2E Admin Branch" });
  await page.getByRole("button", { name: "Create Employee" }).click();
  const employeeRow = page.getByRole("row").filter({ hasText: "e2e-admin-loader@test.local" });
  await expect(employeeRow).toContainText("E2E Admin Loader");
  await employeeRow.getByPlaceholder("New password").fill("E2EAdminReset123!");
  await employeeRow.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("row").filter({ hasText: "e2e-admin-loader@test.local" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Audit Logs", exact: true }).click();
  await expect(page.getByPlaceholder("DD/MM/YYYY")).toHaveCount(2);
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await page.getByLabel("Action Type").selectOption("branch_changes");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Create Branch", { exact: true })).toBeVisible();

  await page.getByLabel("Action Type").selectOption("product_changes");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Create Product", { exact: true })).toBeVisible();

  await page.getByLabel("Action Type").selectOption("password_resets");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Reset User Password", { exact: true })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Security", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account Security" })).toBeVisible();
});
