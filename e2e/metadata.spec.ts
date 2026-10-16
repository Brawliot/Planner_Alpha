import { test, expect } from "@playwright/test";

test("títulos de página con la plantilla de la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Mando");

  await page.goto("/login");
  await expect(page).toHaveTitle("Iniciar sesión · Mando");

  await page.goto("/registro");
  await expect(page).toHaveTitle("Crear Cuenta · Mando");

  await page.goto("/no-existe");
  await expect(page).toHaveTitle("Página no encontrada · Mando");
});

test("theme-color y color-scheme para claro y oscuro", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "light dark");
});