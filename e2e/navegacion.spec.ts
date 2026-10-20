import { test, expect } from "@playwright/test";

test("sin sesión, la página principal muestra la portada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "¿Qué negocio quieres montar?" })).toBeVisible();
});

test("desde la portada, el login se abre en un popup y se cierra con Escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Iniciar sesión" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test("al entrar directamente en /login se ve la página, no el popup", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("una dirección que no existe muestra la página 404", async ({ page }) => {
  const response = await page.goto("/no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("la tarjeta gira entre login y registro y actualiza la URL", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Regístrate" }).click();

  await expect(page.getByRole("heading", { name: "Crear Cuenta" })).toBeVisible();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toHaveCount(0);

  await page.getByRole("button", { name: "Inicia sesión" }).click();
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("el registro enlaza al aviso legal y la página existe", async ({ page }) => {
  await page.goto("/registro");
  const link = page.locator("section:not([inert])").getByRole("link", { name: /Aviso legal/ });
  await expect(link).toHaveAttribute("href", "/legal/aviso");

  await page.goto("/legal/aviso");
  await expect(page.getByRole("heading", { name: "Aviso legal" })).toBeVisible();
});