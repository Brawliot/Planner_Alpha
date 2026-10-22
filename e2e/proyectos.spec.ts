import { test, expect } from "@playwright/test";
import { createUser, deleteTestUsers, login, resetRateLimits, skipSummaryPopup, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await skipSummaryPopup(page);
  await resetRateLimits();
  const email = uniqueEmail();
  await createUser(request, email);
  await login(page, email);
});

test.afterAll(async () => {
  await deleteTestUsers();
});

test("sin ideas: la portada se queda y Mis proyectos invita a empezar", async ({ page }) => {
  await expect(page.getByLabel("Tu idea")).toBeVisible();
  await page.getByRole("link", { name: "Mis proyectos" }).click();
  await expect(page).toHaveURL(/\/proyectos$/);
  await expect(page.getByRole("heading", { name: "Empieza con tu primera idea" })).toBeVisible();
});

test("con una idea: la portada lleva a Mis proyectos, la tarjeta abre el informe y Nueva idea vuelve a la portada", async ({ page }) => {
  await page.getByLabel("Tu idea").fill("Una app de facturación");
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.waitForURL(/\/informe\//);
  const reportUrl = page.url();

  await page.goto("/");
  await expect(page).toHaveURL(/\/proyectos$/);
  const card = page.getByRole("listitem").filter({ hasText: "Una app de facturación" });
  await expect(card).toBeVisible();

  await card.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(reportUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  await page.goto("/proyectos");
  await page.getByRole("link", { name: "Nueva idea" }).click();
  await expect(page.getByLabel("Tu idea")).toBeVisible();
});

test("otro usuario no ve tus proyectos", async ({ page, browser, request }) => {
  await page.getByLabel("Tu idea").fill("Idea privada de prueba");
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.waitForURL(/\/informe\//);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await skipSummaryPopup(otherPage);
  const email = uniqueEmail();
  await createUser(request, email);
  await login(otherPage, email);
  await otherPage.goto("/proyectos");
  await expect(otherPage.getByRole("heading", { name: "Empieza con tu primera idea" })).toBeVisible();
  await expect(otherPage.getByText("Idea privada de prueba")).toHaveCount(0);
  await other.close();
});