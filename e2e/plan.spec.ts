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
  await page.getByRole("button", { name: "Continuar igualmente" }).click();
  await expect(page.getByText("Aprobado · listo para planificar")).toBeVisible();
  return page.url();
}

/** Entra en la primera tarea que se puede personalizar (las de decisión, por ejemplo, no). */
async function openPersonalizableTask(page: Page) {
  const hrefs = await page
    .locator('a[href*="/plan/tarea/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href") ?? ""))]);
  for (const href of hrefs) {
    await page.goto(href);
    // count() no espera: antes hay que dejar que termine de cargar la tarea (Suspense).
    await expect(page.getByText("Cargando...")).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    if ((await page.getByRole("button", { name: "Personalizar con IA" }).count()) > 0) return;
  }
  throw new Error("Ninguna tarea del plan se puede personalizar");
}

/** Abre "Adjust" cuando la página ya ha cargado del todo y comprueba que se ve el formulario. */
async function openAdjust(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Ajustar" }).click();
  await expect(page.getByLabel("Horas por semana")).toBeVisible();
}

test.describe("plan", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  test("desde el informe aprobado se crea el plan y se ve por fases", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.getByRole("link", { name: "Mi plan" }).click();
    await expect(page).toHaveURL(`${reportUrl}/plan`);

    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();
    await expect(page.getByText("Validar", { exact: true })).toBeVisible();
    await expect(page.getByText(/You open: weeks \d+–\d+/)).toBeVisible();

    // El header muestra "Plan" en el plan y en sus tareas, y lleva de vuelta al plan.
    const headerPlan = page.getByRole("banner").getByRole("link", { name: "Plan", exact: true });
    await expect(headerPlan).toBeVisible();
    await page.getByRole("region", { name: "Ahora" }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/plan\/tarea\//);
    await headerPlan.click();
    await expect(page).toHaveURL(`${reportUrl}/plan`);
  });

    test("cada tarea tiene su página: se ve el paso actual y al marcarlo se queda en ella", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();

    const firstTask = page.getByRole("region", { name: "Ahora" }).getByRole("link").first();
    const title = (await firstTask.textContent()) ?? "";
    await firstTask.click();
    await expect(page).toHaveURL(/\/plan\/tarea\//);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Está hecho cuando", { exact: true }).first()).toBeVisible();

    const url = page.url();
    await page.getByRole("button", { name: "Saltar" }).first().click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("progressbar", { name: "Pasos" })).toHaveAttribute("aria-valuenow", "1");
  });

  test("el mapa de fases muestra la tarea de una estación y lleva a ella", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();

    await page.getByRole("tab", { name: "Tarea" }).click();
    await page.getByRole("link", { name: /Open task/ }).click();
    await expect(page).toHaveURL(/\/plan\/tarea\//);
  });

    test("el cronograma se abre desde el selector y marca la apertura", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Cronograma" }).click();
    await expect(page.getByRole("button", { name: "Cronograma" })).toHaveAttribute("aria-pressed", "true");
    // Se abre en las próximas 12 semanas; "Whole plan" muestra todo, con la apertura.
    await expect(page.getByRole("button", { name: "Próximas 12 semanas" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Todo el plan" }).click();
    await expect(page.getByRole("button", { name: "Todo el plan" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/◆ Opening · weeks \d+–\d+/)).toBeVisible();

    // Un departamento se despliega en sus objetivos y tareas, y se pliega de nuevo.
    const department = page.locator("[data-dept]").first();
    await department.click();
    await expect(department).toContainText("▾");
    await department.click();
    await expect(department).toContainText("▸");
  });


  test("la vista de áreas muestra la constelación y lleva a las tareas", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Áreas" }).click();
    await expect(page.getByRole("button", { name: "Áreas" })).toHaveAttribute("aria-pressed", "true");

    // Pulsar un área la enfoca y muestra el riel; desde el riel se salta a otra; "All areas" vuelve a la rueda.
    await page.locator("[data-area]").first().click();
    const back = page.getByRole("button", { name: /All areas/ });
    await expect(back).toBeVisible();
    const rail = page.locator("[data-rail]");
    await expect(rail.locator("button[aria-pressed=true]")).toHaveCount(1);
    const first = await rail.locator("button[aria-pressed=true]").innerText();
    await rail.locator("button[aria-pressed=false]").first().click();
    await expect(rail.locator("button[aria-pressed=true]")).toHaveCount(1);
    await expect(rail.locator("button[aria-pressed=true]")).not.toHaveText(first);
    await back.click();
    await expect(page.getByText("Pulsa un área para verla en detalle")).toBeVisible();
    // Ir a una tarea ya no se hace desde Áreas (el enlace "Open task" vive en el mapa de Fases).
  });

  test("el panel se pliega a un riel y se vuelve a abrir desde él", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("region", { name: "Ahora" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Plegar panel" }).click();
    await expect(page.getByRole("region", { name: "Ahora" })).toHaveCount(0);

    await page.getByRole("button", { name: "Ahora" }).click();
    await expect(page.getByRole("region", { name: "Ahora" })).toBeVisible();
  });

  test("ajustar las horas se guarda", async ({ page }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();

    await openAdjust(page);
    await page.getByLabel("Horas por semana").selectOption("5-10");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await openAdjust(page);
    await expect(page.getByLabel("Horas por semana")).toHaveValue("5-10");
  });

  test("con el informe sin aprobar no se puede crear", async ({ page }) => {
    await page.getByLabel("Tu idea").fill("Una app de facturación");
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.waitForURL(/\/informe\//);
    await page.goto(`${page.url()}/plan`);
    await expect(page.getByText("Aprueba tu informe para crear el plan.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear mi plan" })).toHaveCount(0);
  });

  async function createPlanFor(page: Page, idea?: string) {
    const reportUrl = await approvedReport(page, idea);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();
    await page.waitForLoadState("networkidle");
  }

  test("personalizar una tarea con IA la sustituye por la personalizada", async ({ page }) => {
    await createPlanFor(page);
    await openPersonalizableTask(page);
    await page.getByRole("button", { name: "Personalizar con IA" }).click();
    await expect(page.getByRole("heading", { name: /Personalized task/ }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Personalizada", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver a generar" }).first()).toBeVisible();
  });

  test("si la IA pregunta antes, se responde en la tarea y se personaliza", async ({ page }) => {
    await createPlanFor(page, "Una app de facturación [gpt:ask]");
    await openPersonalizableTask(page);
    await page.getByRole("button", { name: "Personalizar con IA" }).click();
    await expect(page.getByText("Fake question?")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("radio", { name: "Option A" }).check();
    await page.getByRole("button", { name: "Responder y personalizar" }).click();
    await expect(page.getByRole("heading", { name: /Personalized task/ }).first()).toBeVisible({ timeout: 20_000 });
  });

  test("si la IA cae, se avisa y la tarea se queda como estaba", async ({ page }) => {
    await createPlanFor(page, "Una app de facturación [gpt:down-plan]");
    await openPersonalizableTask(page);
    await page.getByRole("button", { name: "Personalizar con IA" }).click();
    await expect(page.getByText("La IA no está disponible ahora. Inténtalo en unos minutos.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Personalized task/ })).toHaveCount(0);
  });

  test("'Ahora' muestra lo que se puede empezar; un paso se marca como hecho y se reabre", async ({ page }) => {
    await createPlanFor(page);
    const now = page.getByRole("region", { name: "Ahora" });
    await expect(now).toBeVisible();
    // La tarjeta de "Now" con un paso que se puede marcar como hecho.
    const card = now.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Hecho" }) }).first();
    const href = (await card.getByRole("link").first().getAttribute("href")) ?? "";
    await card.getByRole("button", { name: "Hecho" }).click();
    await page.waitForLoadState("networkidle");

    // El paso hecho se puede reabrir en la página de su tarea.
    await page.goto(href);
    // "Reopen" está dentro del desplegable del paso: se cuenta aunque esté oculto y se abre para pulsarlo.
    const reopen = page.getByRole("button", { name: "Reabrir", includeHidden: true });
    await expect(reopen).toHaveCount(1);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await reopen.click();
    await page.waitForLoadState("networkidle");
    await expect(reopen).toHaveCount(0);
  });

  test("otro usuario no puede ver el plan", async ({ page, browser, request }) => {
    const reportUrl = await approvedReport(page);
    await page.goto(`${reportUrl}/plan`);
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Tu plan" })).toBeVisible();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    const email = uniqueEmail();
    await createUser(request, email);
    await login(otherPage, email);
    await otherPage.goto(`${reportUrl}/plan`);
    // Con Suspense el estado HTTP ya salió como 200: se comprueba lo que se ve, como en el informe.
    await expect(otherPage.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
    await expect(otherPage.getByRole("heading", { name: "Tu plan" })).toHaveCount(0);
    await other.close();
  });
});