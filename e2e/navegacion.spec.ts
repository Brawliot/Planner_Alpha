import { test, expect } from "@playwright/test";

test("sin sesión, la página principal redirige a /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

test("una dirección que no existe muestra la página 404", async ({ page }) => {
  const response = await page.goto("/no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("la tarjeta gira entre login y registro y actualiza la URL", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Regístrate" }).click();

  await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toHaveCount(0);

  await page.getByRole("button", { name: "Inicia sesión" }).click();
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});