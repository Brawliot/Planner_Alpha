import { test, expect, type Page } from "@playwright/test";
import { createUser, deleteTestUsers, login, resetRateLimits, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

async function approvedReport(page: Page) {
  await page.getByLabel("Mensaje").fill("Una app de facturación");
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.waitForURL(/\/informe\//);
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await expect(page.getByText("Approved · ready to plan")).toBeVisible();
  return page.url();
}

test.describe("plan", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  test("desde el informe aprobado se crea el plan y se ve por fases", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.getByRole("link", { name: "My plan" }).click();
    await expect(page).toHaveURL(`${reportUrl}/plan`);

    await page.getByRole("button", { name: "Create my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validate" })).toBeVisible();
    await expect(page.getByText(/You open: weeks \d+–\d+/)).toBeVisible();
  });

  test("ajustar las horas se guarda", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Create my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

    await page.getByText("Adjust").click();
    await page.getByLabel("Hours per week").selectOption("5-10");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await page.getByText("Adjust").click();
    await expect(page.getByLabel("Hours per week")).toHaveValue("5-10");
  });

  test("con el informe sin aprobar no se puede crear", async ({ page }) => {
    await page.getByLabel("Mensaje").fill("Una app de facturación");
    await page.getByRole("button", { name: "Enviar" }).click();
    await page.waitForURL(/\/informe\//);
    await page.goto(`${page.url()}/plan`);
    await expect(page.getByText("Approve your report to create the plan.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create my plan" })).toHaveCount(0);
  });

  test("otro usuario no puede ver el plan", async ({ page, browser, request }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Create my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    const email = uniqueEmail();
    await createUser(request, email);
    await login(otherPage, email);
    const response = await otherPage.goto(`${reportUrl}/plan`);
    expect(response?.status()).toBe(404);
    await other.close();
  });
});