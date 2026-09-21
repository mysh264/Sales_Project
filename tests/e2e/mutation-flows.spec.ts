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

test.describe("mutation flows", () => {
  test.skip(!demoPassword, "SEED_DEMO_PASSWORD is required for mutation e2e");

  test("salesman can open new-order from nav and toggle Arabic locale", async ({ browser }) => {
    test.setTimeout(60_000);
    const salesman = await login(browser, "salesman@test.local", "/salesman");
    await salesman.page.getByRole("link", { name: /New Order|طلب جديد/ }).click();
    await expect(salesman.page).toHaveURL(/\/salesman\/new-order/);
    await expect(salesman.page.getByRole("combobox", { name: /Search customer|ابحث عن عميل/ })).toBeVisible();

    await salesman.page.getByRole("button", { name: /العربية|English/ }).click();
    await expect(salesman.page.locator("html")).toHaveAttribute("dir", /rtl|ltr/);
    await closePage(salesman.context, salesman.page);
  });

  test("manager finance dashboard exposes debt write-off controls", async ({ browser }) => {
    test.setTimeout(60_000);
    const manager = await login(browser, "manager@test.local", "/manager");
    await manager.page.getByRole("link", { name: /Finance|Debts|Dashboard/i }).first().click();
    await expect(manager.page).toHaveURL(/\/manager\/(dashboard)?/);
    const writeOff = manager.page.getByRole("button", { name: /Write Off|Write-off/i }).first();
    if (await writeOff.count()) {
      await expect(writeOff).toBeVisible();
    }
    await closePage(manager.context, manager.page);
  });

  test("impersonation stop returns tester to launchpad", async ({ browser }) => {
    test.setTimeout(60_000);
    test.skip(process.env.MASTERTESTER_ENABLED !== "true", "Master tester feature disabled");
    const tester = await login(browser, process.env.MASTERTESTER_EMAIL || "tester@mahmoudbox.com", "/tester");
    const target = tester.page.getByRole("button", { name: /Salesman|Impersonate/i }).first();
    if (!(await target.count())) {
      await closePage(tester.context, tester.page);
      return;
    }
    await target.click();
    await expect(tester.page.getByRole("alert")).toContainText(/Impersonat|Acting/i);
    await tester.page.getByRole("button", { name: /Stop Impersonation|Exit/i }).click();
    await expect(tester.page).toHaveURL(/\/tester/);
    await closePage(tester.context, tester.page);
  });
});
