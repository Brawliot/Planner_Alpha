import { test, expect, type Page } from "@playwright/test";
import { createUser, deleteTestUsers, login, resetRateLimits, skipSummaryPopup, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => {
  await skipSummaryPopup(page);
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

async function approvedReport(page: Page, idea = "Una app de facturación") {
  await page.getByLabel("Tu idea").fill(idea);
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.waitForURL(/\/informe\//);
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await expect(page.getByText("Approved · ready to plan")).toBeVisible();
  return page.url();
}

/** Entra en la primera tarea que se puede personalizar (las de decisión, por ejemplo, no). */
async function openPersonalizableTask(page: Page) {
  const hrefs = await page
    .locator('a[href*="/plan/tarea/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href") ?? ""))]);
  for (const href of hrefs) {
    await page.goto(href);
    if ((await page.getByRole("button", { name: "Personalize with AI" }).count()) > 0) return;
  }
  throw new Error("Ninguna tarea del plan se puede personalizar");
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

    test("cada tarea tiene su página: se ve el paso actual y al marcarlo se queda en ella", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Create my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

    const firstTask = page.getByRole("region", { name: "Now" }).getByRole("link").first();
    const title = (await firstTask.textContent()) ?? "";
    await firstTask.click();
    await expect(page).toHaveURL(/\/plan\/tarea\//);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Done when", { exact: true }).first()).toBeVisible();

    const url = page.url();
    await page.getByRole("button", { name: "Skip" }).first().click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("progressbar", { name: "Steps" })).toHaveAttribute("aria-valuenow", "1");
  });

  test("el mapa de fases muestra la tarea de una estación y lleva a ella", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Create my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

    await page.getByRole("link", { name: /Open task/ }).click();
    await expect(page).toHaveURL(/\/plan\/tarea\//);
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
    await page.getByLabel("Tu idea").fill("Una app de facturación");
    await page.getByRole("button", { name: "Empezar" }).click();
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
    await openPersonalizableTask(page);
    await page.getByRole("button", { name: "Personalize with AI" }).click();
    await expect(page.getByRole("heading", { name: /Personalized task/ }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Personalized", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate again" }).first()).toBeVisible();
  });

  test("si la IA pregunta antes, se responde en la tarea y se personaliza", async ({ page }) => {
    await createPlanFor(page, "Una app de facturación [gpt:ask]");
    await openPersonalizableTask(page);
    await page.getByRole("button", { name: "Personalize with AI" }).click();
    await expect(page.getByText("Fake question?")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("radio", { name: "Option A" }).check();
    await page.getByRole("button", { name: "Answer and personalize" }).click();
    await expect(page.getByRole("heading", { name: /Personalized task/ }).first()).toBeVisible({ timeout: 20_000 });
  });

  test("si la IA cae, se avisa y la tarea se queda como estaba", async ({ page }) => {
    await createPlanFor(page, "Una app de facturación [gpt:down-plan]");
    await openPersonalizableTask(page);
    await page.getByRole("button", { name: "Personalize with AI" }).click();
    await expect(page.getByText("The AI is not available right now. Try again in a few minutes.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Personalized task/ })).toHaveCount(0);
  });

  test("'Ahora' muestra lo que se puede empezar; un paso se marca como hecho y se reabre", async ({ page }) => {
    await createPlanFor(page);
    const now = page.getByRole("region", { name: "Now" });
    await expect(now).toBeVisible();
    // La tarjeta de "Now" con un paso que se puede marcar como hecho.
    const card = now.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Done" }) }).first();
    const href = (await card.getByRole("link").first().getAttribute("href")) ?? "";
    await card.getByRole("button", { name: "Done" }).click();
    await page.waitForLoadState("networkidle");

    // El paso hecho se puede reabrir en la página de su tarea.
    await page.goto(href);
    const reopen = page.getByRole("button", { name: "Reopen" });
    await expect(reopen).toHaveCount(1);
    await reopen.click();
    await page.waitForLoadState("networkidle");
    await expect(reopen).toHaveCount(0);
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