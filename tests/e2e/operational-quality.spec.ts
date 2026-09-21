import { expect, test, type Browser, type Page } from "@playwright/test";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "";

async function login(browser: Browser, email: string, expectedPath: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.waitForTimeout(600);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(demoPassword);
  await Promise.all([
    page.waitForURL(new RegExp(`${expectedPath.replace("/", "\\/")}$`), { timeout: 25_000 }),
    page.getByRole("button", { name: "Login" }).click(),
  ]);
  return { context, page };
}

async function closePage(context: Awaited<ReturnType<Browser["newContext"]>>, page: Page) {
  await page.close();
  await context.close();
}

test.describe("operational route quality", () => {
  test.skip(!demoPassword, "SEED_DEMO_PASSWORD is required");

  test("inventory → morning load → invoice → evening return → reconciliation", async ({ browser }) => {
    test.setTimeout(180_000);

    const manager = await login(browser, "manager@test.local", "/manager");
    await manager.page.getByRole("link", { name: /Inventory|المخزون/i }).click();
    await manager.page.getByLabel(/Full cylinder adjustment/i).fill("10");
    await manager.page.getByPlaceholder(/Reason for adjustment/i).fill("Quality wave opening stock");
    await manager.page.getByRole("button", { name: /Record Audited Adjustment/i }).click();
    await closePage(manager.context, manager.page);

    const loaderMorning = await login(browser, "loader@test.local", "/loader");
    const salesmanRow = loaderMorning.page.getByRole("row").filter({ hasText: "Test Salesman" }).first();
    await salesmanRow.getByRole("link", { name: /Morning Load|تحميل صباحي/i }).click();
    await loaderMorning.page.getByLabel(/Full Cylinders Loaded/i).first().fill("3");
    await loaderMorning.page.getByRole("button", { name: /Save Morning Load/i }).click();
    await expect(loaderMorning.page.getByText(/Existing route today|MORNING/i)).toBeVisible();
    await closePage(loaderMorning.context, loaderMorning.page);

    const salesman = await login(browser, "salesman@test.local", "/salesman");
    await salesman.page.getByRole("link", { name: /Create New Invoice|إنشاء فاتورة/i }).click();
    await expect(salesman.page).toHaveURL(/\/salesman\/new-order/);
    await expect(salesman.page.locator("form[data-hydrated='true']")).toBeAttached({ timeout: 20_000 });
    await salesman.page.getByRole("button", { name: /Add New Customer/i }).click();
    const customerModal = salesman.page.locator(".fixed.inset-0");
    const stamp = Date.now().toString().slice(-6);
    await customerModal.getByLabel(/^Name$/i).fill(`Quality Flow ${stamp}`);
    await customerModal.getByLabel(/^Phone$/i).fill(`+96891${stamp}`);
    await customerModal.getByRole("button", { name: /Save Customer/i }).click();
    await salesman.page.getByPlaceholder(/Delivered/i).first().fill("1");
    await salesman.page.getByPlaceholder(/Collected/i).first().fill("1");
    await salesman.page.getByLabel(/Cash Amount/i).fill("6.300");
    await salesman.page.getByRole("button", { name: /Save Invoice/i }).click();
    await expect(salesman.page).toHaveURL(/\/salesman\/receipt\//, { timeout: 30_000 });
    await closePage(salesman.context, salesman.page);

    const loaderEvening = await login(browser, "loader@test.local", "/loader");
    const returnRow = loaderEvening.page.getByRole("row").filter({ hasText: "Test Salesman" }).first();
    await returnRow.getByRole("link", { name: /Evening Return|إرجاع مسائي/i }).click();
    await loaderEvening.page.getByLabel(/Returned Full/i).fill("2");
    await loaderEvening.page.getByLabel(/Returned Empty/i).fill("1");
    await loaderEvening.page.getByRole("button", { name: /Save Evening Return/i }).click();
    await expect(loaderEvening.page.getByRole("heading", { name: /Test Salesman/i })).toBeVisible();
    await closePage(loaderEvening.context, loaderEvening.page);

    const managerReview = await login(browser, "manager@test.local", "/manager");
    await managerReview.page.getByRole("link", { name: /Reconciliation|المصالحة/i }).click();
    await expect(managerReview.page.getByRole("row").filter({ hasText: "Test Salesman" }).first()).toBeVisible();
    await closePage(managerReview.context, managerReview.page);
  });

  test("manager finance dashboard exposes debt tools after sales", async ({ browser }) => {
    test.setTimeout(90_000);
    const manager = await login(browser, "manager@test.local", "/manager");
    await manager.page.getByRole("link", { name: /Finance|Debts|المالية/i }).first().click();
    await expect(manager.page).toHaveURL(/\/manager\/dashboard/);
    await expect(manager.page.getByRole("heading", { name: /Financial Overview|نظرة/i })).toBeVisible();
    await closePage(manager.context, manager.page);
  });
});
