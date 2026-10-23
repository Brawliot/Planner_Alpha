import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  deleteTestUsers,
  login,
  reportIdFrom,
  resetRateLimits,
  skipSummaryPopup,
  uniqueEmail,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await skipSummaryPopup(page);
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

/** Palabras vacías inglesas y valores internos del catálogo: si aparecen, hay un texto sin traducir. */
const ENGLISH = /\b(the|your|you|and|with|what|how|when|where|who|continue|saving|question|questions|progress|analysing|idea only|not decided yet|not specified)\b/i;

async function expectSpanish(page: Page) {
  const text = await page.locator("body").innerText();
  // La idea de la usuaria lleva marcas del Jev falso entre corchetes: no cuentan.
  const visible = text.replace(/\[jev:[^\]]*\]/g, "");
  expect(visible.match(ENGLISH)?.[0] ?? null, `texto en inglés en ${page.url()}`).toBeNull();
}

test("el flujo entero, de las preguntas al informe y su edición, sale en español", async ({ page, request }) => {
  const email = uniqueEmail();
  await createUser(request, email);
  await login(page, email);

  await page.getByLabel("Tu idea").fill("Una tienda online de velas [jev:unsure]");
  await page.getByRole("button", { name: "Empezar" }).click();

  // Cada tema de preguntas (con confianza baja salen los 4).
  for (let step = 0; step < 4; step++) {
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
    await expectSpanish(page);
    for (const group of await page.getByRole("group").all()) {
      await group.getByRole("radio").first().check();
    }
    await page.getByRole("button", { name: "Continuar" }).click();
  }

  await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
  await expectSpanish(page);

  const id = reportIdFrom(page.url());
  await page.goto(`/informe/${id}/editar`);
  await expect(page.getByRole("heading", { name: "Editar los datos del informe" })).toBeVisible();
  await expectSpanish(page);
});
