import { test, expect } from "@playwright/test";

test("la cabecera enlaza a la portada", async ({ page }) => {
  await page.goto("/not-found-xyz");
  await page.getByRole("banner").getByRole("link", { name: "Mando" }).click();
  await expect(page).toHaveURL("/");
});

test("sin sesión, la cabecera no muestra cerrar sesión", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
});

test("el primer Tab lleva a 'Saltar al contenido' y mueve el foco al main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenido")).toBeFocused();
});