import { test, expect } from "@playwright/test";

test.describe("portada", () => {
  test("muestra el campo Mensaje y el botón Enviar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Mensaje")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible();
  });

  test("el botón está deshabilitado con el campo vacío o solo espacios", async ({ page }) => {
    await page.goto("/");
    const boton = page.getByRole("button", { name: "Enviar" });
    await expect(boton).toBeDisabled();

    await page.getByLabel("Mensaje").fill("   ");
    await expect(boton).toBeDisabled();
  });

  test("Enter envía el mensaje y vacía el campo", async ({ page }) => {
    await page.goto("/");
    const campo = page.getByLabel("Mensaje");
    await campo.fill("Hola mundo");
    await campo.press("Enter");

    await expect(page.getByText("Último envío: Hola mundo")).toBeVisible();
    await expect(campo).toHaveValue("");
  });

  test("el botón envía el mensaje y vacía el campo", async ({ page }) => {
    await page.goto("/");
    const campo = page.getByLabel("Mensaje");
    await campo.fill("Hola mundo");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Último envío: Hola mundo")).toBeVisible();
    await expect(campo).toHaveValue("");
  });

  test("el campo tiene maxlength 2000", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Mensaje")).toHaveAttribute("maxlength", "2000");
  });

  test("sin sesión, la cabecera tiene los enlaces y Iniciar sesión abre el popup", async ({ page }) => {
    await page.goto("/");
    const cabecera = page.getByRole("banner");
    await expect(cabecera.getByRole("link", { name: "Crear cuenta" })).toBeVisible();

    await cabecera.getByRole("link", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});