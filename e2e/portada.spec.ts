import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";

test.describe("portada", () => {
  test("muestra el titular, el campo Tu idea y el botón Empezar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Qué negocio quieres montar?" })).toBeVisible();
    await expect(page.getByLabel("Tu idea")).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible();
  });

  test("el botón está deshabilitado con el campo vacío o solo espacios", async ({ page }) => {
    await page.goto("/");
    const boton = page.getByRole("button", { name: "Empezar" });
    await expect(boton).toBeDisabled();

    await page.getByLabel("Tu idea").fill("   ");
    await expect(boton).toBeDisabled();
  });

  test("el campo tiene maxlength 2000 y cuenta los caracteres", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Tu idea")).toHaveAttribute("maxlength", "2000");
    await page.getByLabel("Tu idea").fill("Hola");
    await expect(page.getByText("4 / 2000")).toBeVisible();
  });

  test("un ejemplo rellena la idea y deja el foco en el campo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Cafetería" }).click();
    await expect(page.getByLabel("Tu idea")).toHaveValue(/cafetería/i);
    await expect(page.getByLabel("Tu idea")).toBeFocused();
  });

  test("sin sesión, se ve la sección De idea a plan con los ejemplos marcados", async ({ page }) => {
    await page.goto("/");
    const seccion = page.getByRole("region", { name: "De idea a plan, sin humo" });
    await expect(seccion).toBeVisible();
    await expect(seccion.getByText("Ejemplo")).toHaveCount(2);
  });

  test("sin sesión, se ven las preguntas frecuentes y la llamada final lleva a la caja", async ({ page }) => {
    await page.goto("/");
    const faq = page.getByRole("region", { name: "Preguntas frecuentes" });
    await faq.getByText("¿Lo hace una IA?").click();
    await expect(faq.getByText("Las cifras y las fechas las calcula el código", { exact: false })).toBeVisible();

    await page.getByRole("link", { name: "Escribir mi idea" }).click();
    await expect(page).toHaveURL(/#idea$/);
    await expect(page.getByLabel("Tu idea")).toBeInViewport();
  });

  test("el pie enlaza al aviso legal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Aviso legal" })).toHaveAttribute("href", "/legal/aviso");
  });

  test("sin sesión, la idea escrita se conserva al volver a la portada", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Tu idea").fill("Un bar de tapas en Madrid");
    await page.goto("/");
    await expect(page.getByLabel("Tu idea")).toHaveValue("Un bar de tapas en Madrid");
  });

  test("sin sesión, enviar una idea lleva a iniciar sesión", async ({ page }) => {
    await page.goto("/");
getByText("Hola, Ana Prueba")
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