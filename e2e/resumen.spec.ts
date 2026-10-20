import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { createUser, deleteTestUsers, login, resetRateLimits, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

async function createReport(page: Page, request: APIRequestContext, idea: string) {
  const email = uniqueEmail();
  await createUser(request, email);
  await login(page, email);
  await page.getByLabel("Tu idea").fill(idea);
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
}

test("se abre solo la primera vez, marcado como texto de la IA, y se reabre con el botón", async ({ page, request }) => {
  await createReport(page, request, "Una tienda online de cerámica");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("✦ Written by AI", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Executive summary" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("se recorre parte a parte y la última lleva al informe", async ({ page, request }) => {
  await createReport(page, request, "Una academia de idiomas");
  const dialog = page.getByRole("dialog");
  const next = dialog.getByRole("button", { name: "Next", exact: true });
  while (await next.isVisible()) await next.click();
  await dialog.getByRole("button", { name: "View the report" }).click();
  await expect(dialog).toBeHidden();
});

test("si el resumen no pasa la revisión, no se abre solo y ofrece reintentar", async ({ page, request }) => {
  await createReport(page, request, "Una tienda [gpt:numbers]");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Executive summary" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("We couldn't write your summary.")).toBeVisible();
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByText("We still couldn't write it", { exact: false })).toBeVisible();
});

test("Generar informe está visible pero aún no hace nada", async ({ page, request }) => {
  await createReport(page, request, "Un huerto urbano");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: /Generate report/ })).toHaveAttribute("aria-disabled", "true");
});