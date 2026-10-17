import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  createUser,
  deleteTestUsers,
  getReport,
  login,
  reportIdFrom,
  resetRateLimits,
  uniqueEmail,
} from "./helpers";


test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

test.describe("crear informe", () => {
  test("con sesión, enviar la idea crea el informe y lo muestra", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);

    await page.getByLabel("Mensaje").fill("  Un bar de tapas en Malasaña  ");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/informe/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { name: "Your idea", exact: true })).toBeVisible();
    // Se guarda recortada.
    await expect(page.getByText("Un bar de tapas en Malasaña", { exact: true })).toBeVisible();
  });

  test("otro usuario no puede ver el informe", async ({ page, request, browser }) => {
    const owner = uniqueEmail();
    await createUser(request, owner);
    await login(page, owner);
    await page.getByLabel("Mensaje").fill("Idea privada");
    await page.getByRole("button", { name: "Enviar" }).click();
    await page.waitForURL(/\/informe\//);
    const reportUrl = page.url();

    const other = uniqueEmail();
    await createUser(request, other);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await login(otherPage, other);
    await otherPage.goto(reportUrl);

    await expect(otherPage.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
    await expect(otherPage.getByText("Idea privada")).toHaveCount(0);
    await otherContext.close();
  });

  test("sin sesión, el informe lleva a iniciar sesión", async ({ page, request, browser }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
    await page.getByLabel("Mensaje").fill("Otra idea");
    await page.getByRole("button", { name: "Enviar" }).click();
    await page.waitForURL(/\/informe\//);

    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(page.url());
    await expect(anonymousPage).toHaveURL(`${BASE_URL}/login`);
    await anonymous.close();
  });

  test("un id inventado da 404", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
    await page.goto("/informe/no-existe");
    await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  });
});

async function submitIdea(page: import("@playwright/test").Page, idea: string) {
  await page.getByLabel("Mensaje").fill(idea);
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.waitForURL(/\/informe\//);
}

test.describe("clasificación y preguntas", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  test("si Jev lo sabe todo, no hay preguntas ni se muestra la clasificación", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(0);
    // El Jev falso responde la primera opción del sector: no debe aparecer en pantalla.
    await expect(page.getByText("Technology/SaaS")).toHaveCount(0);
  });

  test("solo pregunta lo que no sabe, un tema por pantalla, y salta los temas conocidos", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");

    await expect(page.getByRole("heading", { name: "You" })).toBeVisible();
    await expect(page.getByText("Step 1 of 2")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(1);
    await page.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Full time").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Resources and timing" })).toBeVisible();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(1);
    await page.getByRole("group", { name: "How much can you invest to start?" }).getByLabel("€20k-€50k").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
  });

  test("con confianza baja pregunta los 4 temas, de 3 en 3, sin 'Not specified'", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unsure]");
    await expect(page.getByRole("heading", { name: "Your business" })).toBeVisible();
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(3);
    await expect(page.getByLabel("Not specified")).toHaveCount(0);
  });

  test("el progreso se guarda: al recargar sigue en el tema siguiente", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");
    await page.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Full time").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Resources and timing" })).toBeVisible();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
  });

  test("una pestaña antigua no puede responder un tema que ya pasó", async ({ page, context }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");
    const oldTab = await context.newPage();
    await oldTab.goto(page.url());

    await page.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Full time").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();

    await oldTab.getByRole("group", { name: "How much time can you dedicate?" }).getByLabel("Under 10 h/week").check();
    await oldTab.getByRole("button", { name: "Continue" }).click();
    await expect(oldTab.getByText("Estas preguntas ya no están pendientes. Recarga la página.")).toBeVisible();
  });

  test("si Jev falla, la idea se guarda y se puede reintentar", async ({ page }) => {
    await submitIdea(page, "Algo [jev:down]");
    await expect(page.getByText("No hemos podido analizar tu idea.")).toBeVisible();
    await expect(page.getByText("Algo [jev:down]")).toBeVisible();

    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Seguimos sin poder analizar tu idea.")).toBeVisible();
  });
});


test.describe("análisis: GPT infiere y Jev valida", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  test("si Jev sabe todas las dimensiones, GPT solo estima las cifras", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
    const report = await getReport(reportIdFrom(page.url()));
    expect(report.status).toBe("review");
    const fromGpt = report.facts.filter((f) => f.source.origin === "gpt").map((f) => f.key).sort();
    expect(fromGpt).toEqual(["monthly_fixed_costs_eur", "startup_cost_eur"]);
  });

  test("las cifras se guardan como rango validado y sin presupuesto inventado", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    const report = await getReport(reportIdFrom(page.url()));
    const startup = report.facts.find((f) => f.key === "startup_cost_eur");
    expect(startup?.value).toEqual({ min: 1, max: 1 });
    expect(startup?.source.plausibility).toEqual({ noul: 0.8, model: "jev-1.13.0" });
    // El GPT falso cita un texto que no está en la idea: el presupuesto no se acepta.
    expect(report.facts.some((f) => f.key === "budget_eur")).toBe(false);
  });

  test("lo que Jev no sabe lo infiere GPT y Jev puntúa su plausibilidad", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=competition,regulatory_load]");
    await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
    // La inferencia no se muestra antes del informe.
    await expect(page.getByText("Niche with no clear competitors")).toHaveCount(0);

    const report = await getReport(reportIdFrom(page.url()));
    expect(report.status).toBe("review");
    const competition = report.facts.find((f) => f.key === "competition");
    expect(competition?.value).toBe("Niche with no clear competitors");
    expect(competition?.source.origin).toBe("gpt");
    expect(competition?.source.plausibility).toEqual({ noul: 0.8, model: "jev-1.13.0" });
  });

  test("una inferencia absurda queda guardada con plausibilidad baja", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=competition] [jev:implausible]");
    const report = await getReport(reportIdFrom(page.url()));
    const competition = report.facts.find((f) => f.key === "competition");
    expect(competition?.source.plausibility).toEqual({ noul: 0.1, model: "jev-1.13.0" });
  });

  test('si GPT responde "Cannot infer", el dato sigue sin saberse', async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=competition] [gpt:cannot]");
    const report = await getReport(reportIdFrom(page.url()));
    expect(report.status).toBe("review");
    const competition = report.facts.find((f) => f.key === "competition");
    expect(competition?.source.origin).toBe("jev");
    expect(competition?.value).toBe("Not specified");
  });

  test("si GPT falla, el informe espera en análisis y se puede reintentar", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=competition] [gpt:down]");
    await expect(page.getByText("No hemos podido completar el análisis de tu idea.")).toBeVisible();
    expect((await getReport(reportIdFrom(page.url()))).status).toBe("analysis");

    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Seguimos sin poder completar el análisis.")).toBeVisible();
  });

  test("si GPT se niega, también espera en análisis", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=competition] [gpt:refuse]");
    await expect(page.getByText("No hemos podido completar el análisis de tu idea.")).toBeVisible();
  });

  
  test("las áreas que juzga Jev guardan su veredicto con confianza", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    const report = await getReport(reportIdFrom(page.url()));
    const concept = report.facts.find((f) => f.key === "verdict.concept");
    // El Jev falso elige la primera opción (Strong) con confianza 0,95.
    expect(concept?.value).toBe("Strong");
    expect(concept?.source.confidence).toBe(0.95);
    // Location solo aparece en locales físicos: no hay veredicto.
    expect(report.facts.some((f) => f.key === "verdict.location")).toBe(false);
  });

  
  test("guarda las frases del informe redactadas por GPT", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    const report = await getReport(reportIdFrom(page.url()));
    expect(report.narrative?.areas.concept).toEqual({ text: "Fake assumption", source: "gpt" });
  });

  test("una frase con una cifra inventada se sustituye por la plantilla", async ({ page }) => {
    await submitIdea(page, "Una app de facturación [gpt:numbers]");
    const report = await getReport(reportIdFrom(page.url()));
    expect(report.narrative?.areas.concept?.source).toBe("template");
    expect(report.narrative?.areas.concept?.text).not.toContain("99");
  });

  test("si falla la redacción, el informe sale igualmente con plantillas", async ({ page }) => {
    await submitIdea(page, "Una app de facturación [gpt:down-write]");
    await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
    const report = await getReport(reportIdFrom(page.url()));
    expect(report.status).toBe("review");
    expect(Object.values(report.narrative?.areas ?? {}).every((s) => s.source === "template")).toBe(true);
  });
});


test.describe("pantalla del informe", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  test("muestra cada área con su veredicto y su frase", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
    const concept = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /Concept/ }) });
    await expect(concept.getByText("Strong", { exact: true })).toBeVisible();
    await expect(concept.getByText("Fake assumption")).toBeVisible();
    await expect(page.getByText("Indicative estimate only. It is not financial or legal advice.")).toBeVisible();
  });

  test("no envía al navegador datos internos", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await expect(page.getByRole("heading", { name: "Your idea report" })).toBeVisible();
    const html = await page.content();
    for (const internal of ["jev-1.13.0", "confidence", "plausibility", "gpt-fake"]) {
      expect(html).not.toContain(internal);
    }
  });

  test("si falta un dato imprescindible, el pie pide completar datos", async ({ page }) => {
    await submitIdea(page, "Una app [jev:unknown=competition] [gpt:cannot]");
    const competition = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /Competition/ }) });
    await expect(competition.getByText("Needs info", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add data to evaluate" })).toBeDisabled();
  });

  
  test("al pulsar una tarjeta, el panel muestra su detalle; al volver a pulsarla, se cierra", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    const panelHelp = page.getByText("Press a card's arrow to see its information here.");
    await expect(panelHelp).toBeVisible();

    const concept = page.getByRole("button", { name: /Concept/ });
    await concept.click();
    await expect(concept).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("No estimates: assessment based on what you wrote.")).toBeVisible();

    await concept.click();
    await expect(concept).toHaveAttribute("aria-expanded", "false");
    await expect(panelHelp).toBeVisible();
  });

  test("un área estimada muestra sus supuestos en el panel", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("button", { name: /Money/ }).click();
    await expect(page.getByText("estimated", { exact: true })).toBeVisible();
    await expect(page.getByText("Assumptions", { exact: true })).toBeVisible();
  });

  test("pulsar otra tarjeta cambia el contenido del panel", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    const concept = page.getByRole("button", { name: /Concept/ });
    const money = page.getByRole("button", { name: /Money/ });
    await concept.click();
    await money.click();
    await expect(concept).toHaveAttribute("aria-expanded", "false");
    await expect(money).toHaveAttribute("aria-expanded", "true");
  });

  test("en móvil, el panel se abre justo debajo de la tarjeta pulsada", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("button", { name: /Money/ }).click();
    const moneyCard = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /Money/ }) });
    const next = moneyCard.locator("xpath=following-sibling::li[1]");
    await expect(next.getByText("Assumptions", { exact: true })).toBeVisible();
  });

  
  test("mejorar un área: responde, se recalcula y vuelve con el área abierta", async ({ page }) => {
    await submitIdea(page, "Una app [jev:unknown=competition] [gpt:cannot]");
    const before = await getReport(reportIdFrom(page.url()));

    await page.getByRole("button", { name: /Competition/ }).click();
    await page.getByRole("button", { name: "Improve this area (1)" }).click();
    await page.getByRole("group", { name: "How much competition is there where you will operate?" }).getByLabel("Crowded market").check();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\?area=competition$/);
    const competition = page.getByRole("button", { name: /Competition/ });
    await expect(competition).toHaveAttribute("aria-expanded", "true");
    // Saturado con diferenciador propio (el Jev falso da "Technology or IP"): Watch.
    await expect(competition).toContainText("Watch");
    await expect(page.getByRole("button", { name: /Improve this area/ })).toHaveCount(0);

    const after = await getReport(reportIdFrom(page.url()));
    // Solo cambia la frase del área mejorada.
    expect(after.narrative?.areas.money).toEqual(before.narrative?.areas.money);
  });

  test("un área sin preguntas no muestra 'Improve'", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("button", { name: /Concept/ }).click();
    await expect(page.getByRole("button", { name: /Improve this area/ })).toHaveCount(0);
  });

  test("una pestaña antigua no puede volver a mejorar un área ya respondida", async ({ page, context }) => {
    await submitIdea(page, "Una app [jev:unknown=competition] [gpt:cannot]");
    const oldTab = await context.newPage();
    await oldTab.goto(page.url());

    for (const tab of [page, oldTab]) {
      await tab.getByRole("button", { name: /Competition/ }).click();
      await tab.getByRole("button", { name: "Improve this area (1)" }).click();
      await tab.getByRole("group", { name: "How much competition is there where you will operate?" }).getByLabel("Crowded market").check();
    }
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\?area=competition$/);

    await oldTab.getByRole("button", { name: "Save" }).click();
    await expect(oldTab.getByText("These questions are no longer pending. Reload the page.")).toBeVisible();
  });
});