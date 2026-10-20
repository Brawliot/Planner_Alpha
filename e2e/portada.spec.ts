import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";

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

  test("el campo tiene maxlength 2000", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Mensaje")).toHaveAttribute("maxlength", "2000");
  });

  test("sin sesión, enviar una idea lleva a iniciar sesión", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Mensaje").fill("Un bar de tapas en Madrid");
    await page.getByLabel("Mensaje").press("Enter");
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test("sin sesión, la cabecera tiene los enlaces y Iniciar sesión abre el popup", async ({ page }) => {
    await page.goto("/");
    const cabecera = page.getByRole("banner");
    await expect(cabecera.getByRole("link", { name: "Empezar" })).toBeVisible();

    await cabecera.getByRole("link", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});