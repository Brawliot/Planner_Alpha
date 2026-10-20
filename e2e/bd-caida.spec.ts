import { test, expect } from "@playwright/test";
import { PASSWORD, createUser, deleteTestUsers, resetRateLimits, uniqueEmail } from "./helpers";

const DOWN_URL = "http://localhost:3101";

test.afterAll(async () => {
  await deleteTestUsers();
});

test("con la base de datos caída, /login se sigue abriendo", async ({ page }) => {
  await page.goto(`${DOWN_URL}/login`);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Mando" })).toBeVisible();
});

test("con la base de datos caída, el login muestra un error de conexión", async ({ page }) => {
  await page.goto(`${DOWN_URL}/login`);
  await page.locator("section:not([inert])").getByLabel("Email").fill(uniqueEmail());
  await page.locator("section:not([inert])").getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText("No hemos podido conectar");
});

test("con la base de datos caída, la página principal muestra la página de error", async ({ page, request }) => {
  await resetRateLimits();
  const email = uniqueEmail();
  await createUser(request, email, "Eva Prueba");

  await page.goto("/login");
  await page.locator("section:not([inert])").getByLabel("Email").fill(email);
  await page.locator("section:not([inert])").getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Hola, Eva Prueba")).toBeVisible();

  await page.goto(`${DOWN_URL}/`);
  await expect(page.getByRole("heading", { name: "Algo ha fallado" })).toBeVisible();
});