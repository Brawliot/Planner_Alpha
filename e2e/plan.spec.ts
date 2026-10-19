import { test, expect, type Page } from "@playwright/test";
import { createUser, deleteTestUsers, login, resetRateLimits, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

async function approvedReport(page: Page, idea = "Una app de facturación") {
  await page.getByLabel("Mensaje").fill(idea);
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.waitForURL(/\/informe\//);
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await expect(page.getByText("Approved · ready to plan")).toBeVisible();
  return page.url();
}

/** Abre "Adjust" cuando la página ya ha cargado del todo y comprueba que se ve el formulario. */
async function openAdjust(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.locator("summary", { hasText: "Adjust" }).click();
  await expect(page.getByLabel("Hours per week")).toBeVisible();
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

    await openAdjust(page);
    await page.getByLabel("Hours per week").selectOption("5-10");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await openAdjust(page);
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

  async function createPlanFor(page: Page, idea?: string) {
    const reportUrl = await approvedReport(page, idea);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Create my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
    await page.waitForLoadState("networkidle");
  }

  test("personalizar una tarea con IA la sustituye por la personalizada", async ({ page }) => {
    await createPlanFor(page);
    await page.getByRole("button", { name: "Personalize with AI" }).first().click();
    await expect(page.getByRole("heading", { name: /Personalized task/ }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Personalized", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate again" }).first()).toBeVisible();
  });

  test("si la IA pregunta antes, se responde en la tarea y se personaliza", async ({ page }) => {
    await createPlanFor(page, "Una app de facturación [gpt:ask]");
    await page.getByRole("button", { name: "Personalize with AI" }).first().click();
    await expect(page.getByText("Fake question?")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("radio", { name: "Option A" }).check();
    await page.getByRole("button", { name: "Answer and personalize" }).click();
    await expect(page.getByRole("heading", { name: /Personalized task/ }).first()).toBeVisible({ timeout: 20_000 });
  });

  test("si la IA cae, se avisa y la tarea se queda como estaba", async ({ page }) => {
    await createPlanFor(page, "Una app de facturación [gpt:down-plan]");
    await page.getByRole("button", { name: "Personalize with AI" }).first().click();
    await expect(page.getByText("The AI is not available right now. Try again in a few minutes.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Personalized task/ })).toHaveCount(0);
  });

  test("'Ahora' muestra lo que se puede empezar; un paso se marca como hecho y se reabre", async ({ page }) => {
    await createPlanFor(page);
    const now = page.getByRole("region", { name: "Now" });
    await expect(now).toBeVisible();

    const nextStep = now.getByText(/^Next: /).first();
    const stepText = (await nextStep.textContent())!.replace(/^Next: /, "").trim();
    await now.getByRole("button", { name: "Done" }).first().click();
    await page.waitForLoadState("networkidle");

    // El paso aparece hecho en su tarea, con el botón de reabrir.
    const step = page.getByRole("listitem").filter({ hasText: stepText }).filter({ has: page.getByRole("button", { name: "Reopen" }) });
    await page.locator("summary", { hasText: "Steps" }).first().click();
    await expect(step.first()).toBeVisible();

    await step.first().getByRole("button", { name: "Reopen" }).click();
    await page.waitForLoadState("networkidle");
    await page.locator("summary", { hasText: "Steps" }).first().click();
    await expect(page.getByRole("listitem").filter({ hasText: stepText }).getByRole("button", { name: "Done" }).first()).toBeVisible();
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
    await otherPage.goto(`${reportUrl}/plan`);
    // Con Suspense el estado HTTP ya salió como 200: se comprueba lo que se ve, como en el informe.
    await expect(otherPage.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
    await expect(otherPage.getByRole("heading", { name: "Your plan" })).toHaveCount(0);
    await other.close();
  });
});