import { test, expect } from "@playwright/test";
import { BASE_URL, createUser, deleteTestUsers, login, resetRateLimits, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

test.describe("crear informe", () => {
  test("con sesión, enviar la idea crea el informe y lo muestra", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);

    await page.getByLabel("Mensaje").fill("  Un bar de tapas en Malasaña  ");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/informe/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { name: "Tu idea" })).toBeVisible();
    // Se guarda recortada.
    await expect(page.getByText("Un bar de tapas en Malasaña", { exact: true })).toBeVisible();
  });

  test("otro usuario no puede ver el informe", async ({ page, request, browser }) => {
    const owner = uniqueEmail();
    await createUser(request, owner);
    await login(page, owner);
    await page.getByLabel("Mensaje").fill("Idea privada");
    await page.getByRole("button", { name: "Enviar" }).click();
    await page.waitForURL(/\/informe\//);
    const reportUrl = page.url();

    const other = uniqueEmail();
    await createUser(request, other);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await login(otherPage, other);
    await otherPage.goto(reportUrl);

    await expect(otherPage.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
    await expect(otherPage.getByText("Idea privada")).toHaveCount(0);
    await otherContext.close();
  });

  test("sin sesión, el informe lleva a iniciar sesión", async ({ page, request, browser }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
    await page.getByLabel("Mensaje").fill("Otra idea");
    await page.getByRole("button", { name: "Enviar" }).click();
    await page.waitForURL(/\/informe\//);

    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(page.url());
    await expect(anonymousPage).toHaveURL(`${BASE_URL}/login`);
    await anonymous.close();
  });

  test("un id inventado da 404", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
    await page.goto("/informe/no-existe");
    await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  });
});

async function submitIdea(page: import("@playwright/test").Page, idea: string) {
  await page.getByLabel("Mensaje").fill(idea);
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.waitForURL(/\/informe\//);
}

test.describe("clasificación y preguntas", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  test("si Jev lo sabe todo, no hay preguntas ni se muestra la clasificación", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await expect(page.getByText("Estamos preparando tu informe.")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(0);
    // El Jev falso responde la primera opción del sector: no debe aparecer en pantalla.
    await expect(page.getByText("Technology/SaaS")).toHaveCount(0);
  });

  test("solo pregunta lo que no sabe, un tema por pantalla, y salta los temas conocidos", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");

    await expect(page.getByRole("heading", { name: "You" })).toBeVisible();
    await expect(page.getByText("Step 1 of 2")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(1);
    await page.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Full time").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Resources and timing" })).toBeVisible();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(1);
    await page.getByRole("group", { name: "How much can you invest to start?" }).getByLabel("€20k-€50k").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Estamos preparando tu informe.")).toBeVisible();
  });

  test("con confianza baja pregunta los 4 temas, de 3 en 3, sin 'Not specified'", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unsure]");
    await expect(page.getByRole("heading", { name: "Your business" })).toBeVisible();
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(3);
    await expect(page.getByLabel("Not specified")).toHaveCount(0);
  });

  test("el progreso se guarda: al recargar sigue en el tema siguiente", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");
    await page.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Full time").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Resources and timing" })).toBeVisible();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
  });

  test("una pestaña antigua no puede responder un tema que ya pasó", async ({ page, context }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");
    const oldTab = await context.newPage();
    await oldTab.goto(page.url());

    await page.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Full time").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();

    await oldTab.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Under 10 h/week").check();
    await oldTab.getByRole("button", { name: "Continue" }).click();
    await expect(oldTab.getByText("Estas preguntas ya no están pendientes. Recarga la página.")).toBeVisible();
  });

  test("si Jev falla, la idea se guarda y se puede reintentar", async ({ page }) => {
    await submitIdea(page, "Algo [jev:down]");
    await expect(page.getByText("No hemos podido analizar tu idea.")).toBeVisible();
    await expect(page.getByText("Algo [jev:down]")).toBeVisible();

    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Seguimos sin poder analizar tu idea.")).toBeVisible();
  });
});