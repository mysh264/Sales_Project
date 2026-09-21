import { expect, test, type Browser, type Page } from "@playwright/test";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "";

async function login(browser: Browser, email: string, expectedPath: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${expectedPath.replace("/", "\\/")}$`));
  return { context, page };
}

async function closePage(context: Awaited<ReturnType<Browser["newContext"]>>, page: Page) {
  await page.close();
  await context.close();
}

test.describe("backoffice shadcn wave", () => {
  test.skip(!demoPassword, "SEED_DEMO_PASSWORD is required");

  test("loader reaches home and logistics reconciliation", async ({ browser }) => {
    test.setTimeout(90_000);
    const loader = await login(browser, "loader@test.local", "/loader");
    await expect(loader.page.getByRole("navigation")).toBeVisible();
    await loader.page.getByRole("link", { name: /Reconciliation|المصالحة/i }).first().click();
    await expect(loader.page).toHaveURL(/\/logistics\/reconciliation/);
    await closePage(loader.context, loader.page);
  });

  test("manager dashboard uses app shell and locale toggle", async ({ browser }) => {
    test.setTimeout(90_000);
    const manager = await login(browser, "manager@test.local", "/manager");
    await manager.page.getByRole("link", { name: /Finance|Debts|المالية/i }).first().click();
    await expect(manager.page).toHaveURL(/\/manager\/dashboard/);
    await expect(manager.page.locator("main")).toBeVisible();
    await manager.page.getByRole("button", { name: /العربية|English/ }).click();
    await expect(manager.page.locator("html")).toHaveAttribute("dir", /rtl|ltr/);
    await closePage(manager.context, manager.page);
  });

  test("salesman new-order path stays available after nav i18n", async ({ browser }) => {
    test.setTimeout(60_000);
    const salesman = await login(browser, "salesman@test.local", "/salesman");
    await salesman.page.getByRole("link", { name: /New Order|طلب جديد/ }).click();
    await expect(salesman.page).toHaveURL(/\/salesman\/new-order/);
    await closePage(salesman.context, salesman.page);
  });
});
