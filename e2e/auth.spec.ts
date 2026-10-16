import { test, expect, type Page } from "@playwright/test";
import { BASE_URL, PASSWORD, createUser, deleteTestUsers, resetRateLimits, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("section:not([inert])").getByLabel("Email").fill(email);
  await page.locator("section:not([inert])").getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("registro", () => {
  test("crea la cuenta y entra en la app", async ({ page }) => {
    await page.goto("/registro");
    await page.locator("section:not([inert])").getByLabel("Nombre").fill("Ana Prueba");
    await page.locator("section:not([inert])").getByLabel("Email").fill(uniqueEmail());
    await page.locator("section:not([inert])").getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByRole("heading", { name: "Hola, Ana Prueba" })).toBeVisible();
  });

  test("no permite registrar un email que ya existe", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    await page.goto("/registro");
    await page.locator("section:not([inert])").getByLabel("Nombre").fill("Otra Persona");
    await page.locator("section:not([inert])").getByLabel("Email").fill(email);
    await page.locator("section:not([inert])").getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("rechaza contraseñas filtradas", async ({ page }) => {
    await page.goto("/registro");
    await page.locator("section:not([inert])").getByLabel("Nombre").fill("Ana Prueba");
    await page.locator("section:not([inert])").getByLabel("Email").fill(uniqueEmail());
    await page.locator("section:not([inert])").getByLabel("Contraseña").fill("password1234");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText("filtraciones");
  });

  test("la API rechaza un nombre de más de 100 caracteres", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      headers: { Origin: BASE_URL },
      data: { name: "a".repeat(101), email: uniqueEmail(), password: PASSWORD },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("login y logout", () => {
  test("inicia sesión, cierra sesión y vuelve a pedir login", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email, "Luis Prueba");

    await login(page, email, PASSWORD);
    await expect(page.getByRole("heading", { name: "Hola, Luis Prueba" })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("con contraseña incorrecta muestra un error genérico", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    await login(page, email, "ContraseñaIncorrecta123");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email o contraseña incorrectos");
  });

  test("bloquea tras 5 intentos fallidos, incluso con la contraseña correcta", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    for (let i = 0; i < 5; i++) {
      await login(page, email, "ContraseñaIncorrecta123");
      await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email o contraseña incorrectos");
    }

    await login(page, email, PASSWORD);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Demasiados intentos");
  });

  test("con sesión iniciada, /login y /registro llevan a la página principal", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email, PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);

    await page.goto("/login");
    await expect(page).toHaveURL(`${BASE_URL}/`);

    await page.goto("/registro");
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });
});