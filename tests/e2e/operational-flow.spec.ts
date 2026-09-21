import { expect, test, type Browser, type Page } from "@playwright/test";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "";

async function login(browser: Browser, email: string, expectedPath: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${expectedPath.replace("/", "\\/")}$`));
  return { context, page };
}

async function closePage(context: Awaited<ReturnType<Browser["newContext"]>>, page: Page) {
  await page.close();
  await context.close();
}

test("inventory, loader, salesman, and manager complete one connected route", async ({ browser }) => {
  test.setTimeout(120_000);
  const manager = await login(browser, "manager@test.local", "/manager");
  await manager.page.getByRole("link", { name: "Inventory" }).click();
  await manager.page.getByLabel("Full cylinder adjustment").fill("10");
  await manager.page.getByPlaceholder("Reason for adjustment").fill("Browser workflow opening stock");
  await manager.page.getByRole("button", { name: "Record Audited Adjustment" }).click();
  const acetyleneInventory = manager.page.getByRole("row").filter({ hasText: "Acetylene" }).first();
  await expect
    .poll(async () => Number(await acetyleneInventory.getByRole("cell").nth(2).innerText()))
    .toBeGreaterThan(0);
  await closePage(manager.context, manager.page);

  const loaderMorning = await login(browser, "loader@test.local", "/loader");
  const salesmanRow = loaderMorning.page.getByRole("row").filter({ hasText: "Test Salesman" }).first();
  await salesmanRow.getByRole("link", { name: "Morning Load" }).click();
  await loaderMorning.page.getByLabel("Full Cylinders Loaded").first().fill("3");
  await loaderMorning.page.getByRole("button", { name: "Save Morning Load" }).click();
  await expect(loaderMorning.page.getByText(/Existing route today: MORNING RECORDED/)).toBeVisible();
  await closePage(loaderMorning.context, loaderMorning.page);

  const salesman = await login(browser, "salesman@test.local", "/salesman");
  await salesman.page.getByRole("link", { name: "Create New Invoice" }).click();
  await expect(salesman.page.locator("form[data-hydrated='true']")).toBeAttached();
  await expect(salesman.page.getByPlaceholder("DD/MM/YYYY").first()).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
  await expect(salesman.page.locator('input[name="invoiceDate"]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(salesman.page.locator('input[type="date"]')).toHaveCount(0);
  await salesman.page.getByRole("button", { name: "Add New Customer" }).click();
  const customerModal = salesman.page.locator(".fixed.inset-0");
  await customerModal.getByLabel("Name").fill("Browser Flow Customer");
  await customerModal.getByLabel("Phone").fill("+96891112233");
  await customerModal.getByRole("button", { name: "Save Customer" }).click();
  await salesman.page.getByPlaceholder("Delivered").first().fill("1");
  await salesman.page.getByPlaceholder("Collected").first().fill("1");
  await salesman.page.getByLabel("Cash Amount").fill("6.300");
  await salesman.page.getByRole("button", { name: "Save Invoice & Print" }).click();
  await expect(salesman.page).toHaveURL(/\/salesman\/receipt\//);
  await closePage(salesman.context, salesman.page);

  const loaderEvening = await login(browser, "loader@test.local", "/loader");
  const returnRow = loaderEvening.page.getByRole("row").filter({ hasText: "Test Salesman" }).first();
  await returnRow.getByRole("link", { name: "Evening Return" }).click();
  await loaderEvening.page.getByLabel("Returned Full").fill("2");
  await loaderEvening.page.getByLabel("Returned Empty").fill("1");
  await loaderEvening.page.getByRole("button", { name: "Save Evening Return" }).click();
  await expect(loaderEvening.page.getByRole("heading", { name: "Test Salesman" })).toBeVisible();
  await closePage(loaderEvening.context, loaderEvening.page);

  const managerReview = await login(browser, "manager@test.local", "/manager");
  await managerReview.page.getByRole("link", { name: "Reconciliation" }).click();
  const routeRow = managerReview.page.getByRole("row").filter({ hasText: "Test Salesman" }).first();
  await expect(routeRow).toContainText("1");
  await expect(routeRow).toContainText("Closed");
  await closePage(managerReview.context, managerReview.page);
});
