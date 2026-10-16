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

  test("lo no especificado se pregunta, y al responder pasa a preparar el informe", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown]");

    await expect(page.getByText("2 quick questions")).toBeVisible();
    await expect(page.getByRole("group", { name: "What sector is your business in?" })).toHaveCount(0);

    await page.getByRole("group", { name: "Where will your business operate?" }).getByLabel("Local", { exact: true }).check();
    await page.getByRole("group", { name: "How far along is your idea?" }).getByLabel("Idea only").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Estamos preparando tu informe.")).toBeVisible();
  });

  test("con confianza baja se pregunta todo", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unsure]");
    await expect(page.getByText("3 quick questions")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(3);
    await expect(page.getByLabel("Not specified")).toHaveCount(0);
  });

  test("si Jev falla, la idea se guarda y se puede reintentar", async ({ page }) => {
    await submitIdea(page, "Algo [jev:down]");
    await expect(page.getByText("No hemos podido analizar tu idea.")).toBeVisible();
    await expect(page.getByText("Algo [jev:down]")).toBeVisible();

    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Seguimos sin poder analizar tu idea.")).toBeVisible();
  });
});
});