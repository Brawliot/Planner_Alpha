import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  createUser,
  deleteTestUsers,
  getReport,
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

test.describe("crear informe", () => {
  test("con sesión, enviar la idea crea el informe y lo muestra", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);

    await page.getByLabel("Tu idea").fill("  Un bar de tapas en Malasaña  ");
    await page.getByRole("button", { name: "Empezar" }).click();

    await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/informe/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    // Se guarda recortada.
    await expect(page.getByRole("heading", { level: 1 }).getByText("Un bar de tapas en Malasaña", { exact: true })).toBeVisible();
  });

  test("otro usuario no puede ver el informe", async ({ page, request, browser }) => {
    const owner = uniqueEmail();
    await createUser(request, owner);
    await login(page, owner);
    await page.getByLabel("Tu idea").fill("Idea privada");
    await page.getByRole("button", { name: "Empezar" }).click();
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
    await page.getByLabel("Tu idea").fill("Otra idea");
    await page.getByRole("button", { name: "Empezar" }).click();
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
  await page.getByLabel("Tu idea").fill(idea);
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.waitForURL(/\/informe\//);
}

test.describe("clasificación y preguntas", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

    test("las decisiones admiten 'Not decided yet' y no se vuelven a preguntar", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown=revenue_model]");
    await expect(page.getByRole("navigation", { name: "Progreso" }).locator('[aria-current="step"]')).toContainText("Tu negocio");
    await page.getByRole("group", { name: "¿Cómo ganarás dinero?" }).getByLabel("Aún no lo he decidido").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
  });

  test("si Jev lo sabe todo, no hay preguntas ni se muestra la clasificación", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(0);
    // El Jev falso responde la primera opción del sector: no debe aparecer en pantalla.
    await expect(page.getByText("Technology/SaaS")).toHaveCount(0);
  });

    test("las cantidades escritas no se preguntan y quedan como dichas por el usuario", async ({ page }) => {
    await submitIdea(page, "Un bar de tapas, tengo 20.000 € y abriré en 4 meses");
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();

    const report = await getReport(reportIdFrom(page.url()));
    const fact = (key: string) => report.facts.find((f) => f.key === key);
    expect(fact("budget_band")?.value).toBe("€5k-€20k");
    expect(fact("budget_eur")?.value).toBe(20000);
    expect(fact("budget_eur")?.source).toEqual({ origin: "user", quote: "20.000 €" });
    expect(fact("launch_timeline")?.value).toBe("3-6 months");
  });

  test("solo pregunta lo que no sabe, un tema por pantalla, y salta los temas conocidos", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");

    await expect(page.getByRole("heading", { name: "Tú" })).toBeVisible();
    await expect(page.getByText("Pregunta 1 de 2")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(1);
    await page.getByRole("group", { name: "¿Cuánto tiempo puedes dedicarle?" }).getByLabel("Jornada completa").check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Recursos y plazos" })).toBeVisible();
    await expect(page.getByText("Pregunta 2 de 2")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(1);
    await page.getByRole("group", { name: "¿Cuánto puedes invertir para empezar?" }).getByLabel("€20k-€50k").check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
  });

  test("con confianza baja pregunta los 4 temas, de 3 en 3, sin 'Not specified'", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unsure]");
    await expect(page.getByRole("heading", { name: "Tu negocio" })).toBeVisible();
    await expect(page.getByText("Preguntas 1–3 de 12")).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(3);
    await expect(page.getByLabel("Sin especificar")).toHaveCount(0);
  });

  test("el progreso se guarda: al recargar sigue en el tema siguiente", async ({ page }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");
    await page.getByRole("group", { name: "¿Cuánto tiempo puedes dedicarle?" }).getByLabel("Jornada completa").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Pregunta 2 de 2")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Recursos y plazos" })).toBeVisible();
    await expect(page.getByText("Pregunta 2 de 2")).toBeVisible();
  });

  test("una pestaña antigua no puede responder un tema que ya pasó", async ({ page, context }) => {
    await submitIdea(page, "Algo [jev:unknown=time_commitment,budget_band]");
    const oldTab = await context.newPage();
    await oldTab.goto(page.url());

    await page.getByRole("group", { name: "¿Cuánto tiempo puedes dedicarle?" }).getByLabel("Jornada completa").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Pregunta 2 de 2")).toBeVisible();

    await oldTab.getByRole("group", { name: "¿Cuánto tiempo puedes dedicarle?" }).getByLabel("Menos de 10 h/semana").check();
    await oldTab.getByRole("button", { name: "Continuar" }).click();
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

    test("lo que Jev deduce no se pregunta ni va a GPT, y queda como estimado", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:likely=revenue_model,customer_segment,competition]");
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();

    const report = await getReport(reportIdFrom(page.url()));
    expect(report.status).toBe("review");
    for (const key of ["revenue_model", "customer_segment", "competition"]) {
      const fact = report.facts.find((f) => f.key === key);
      expect(fact?.source.origin, key).toBe("jev");
      expect(fact?.source.from, key).toBe("likely");
    }
  });

  test("si Jev no puede deducirlo, se pregunta", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=customer_segment]");
    await expect(page.getByRole("group")).toHaveCount(1);
  });

  test("si Jev sabe todas las dimensiones, GPT solo estima las cifras", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    const report = await getReport(reportIdFrom(page.url()));
    expect(report.status).toBe("review");
    const fromGpt = report.facts.filter((f) => f.source.origin === "gpt").map((f) => f.key).sort();
    expect(fromGpt).toEqual(["monthly_fixed_costs_eur", "startup_cost_eur"]);
  });

  test("las cifras se guardan como rango validado y sin presupuesto si no se escribió", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    const report = await getReport(reportIdFrom(page.url()));
    const startup = report.facts.find((f) => f.key === "startup_cost_eur");
    expect(startup?.value).toEqual({ min: 1, max: 1 });
    expect(startup?.source.plausibility).toEqual({ noul: 0.8, model: "jev-1.13.0" });
    // La idea no trae cantidades: no hay presupuesto exacto.
    expect(report.facts.some((f) => f.key === "budget_eur")).toBe(false);
  });

  test("lo que Jev no sabe lo infiere GPT y Jev puntúa su plausibilidad", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=competition,regulatory_load]");
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    // La inferencia no se muestra antes del informe.
    await expect(page.getByText("Nicho sin competidores claros")).toHaveCount(0);

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
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
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

    test("el panel muestra lo que falta por concretar y la leyenda no tiene Watch", async ({ page }) => {
    await submitIdea(page, "Una app [jev:unknown=competition] [gpt:cannot]");
    await page.getByRole("button", { name: /Competition/ }).click();
    await expect(page.getByText("Por concretar", { exact: true })).toBeVisible();
    await expect(page.getByText("Watch", { exact: true })).toHaveCount(0);
  });

  test("muestra cada área con su veredicto y su frase", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    const concept = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /Concept/ }) });
    await expect(concept.getByText("A favor", { exact: true })).toBeVisible();
    await expect(concept.getByText("Fake assumption")).toBeVisible();
    await expect(page.getByText("Estimación orientativa, no es asesoramiento financiero ni legal.")).toBeVisible();
  });

  test("no envía al navegador datos internos", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    const html = await page.content();
    for (const internal of ["jev-1.13.0", "confidence", "plausibility", "gpt-fake"]) {
      expect(html).not.toContain(internal);
    }
  });

  test("un área gris que solo se resuelve investigando no pide completar datos", async ({ page }) => {
    await submitIdea(page, "Una app [jev:unknown=competition] [gpt:cannot]");
    const competition = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /Competition/ }) });
    await expect(competition.getByText("Falta información", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completar datos para evaluar" })).toHaveCount(0);
  });
  
  test("al pulsar una tarjeta, el panel muestra su detalle; al volver a pulsarla, se cierra", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    const panelHelp = page.getByText("Pulsa la flecha de una tarjeta para ver su información aquí.");
    await expect(panelHelp).toBeVisible();

    const concept = page.getByRole("button", { name: /Concept/ });
    await concept.click();
    await expect(concept).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Sin estimaciones: valoración basada en lo que has escrito.")).toBeVisible();

    await concept.click();
    await expect(concept).toHaveAttribute("aria-expanded", "false");
    await expect(panelHelp).toBeVisible();
  });

  test("un área estimada muestra sus supuestos en el panel", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("button", { name: /Money/ }).click();
    // Hay una etiqueta del área y otra por cada dato estimado: basta con que se vea alguna.
    await expect(page.getByText("estimado", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Supuestos", { exact: true })).toBeVisible();
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
    await expect(next.getByText("Supuestos", { exact: true })).toBeVisible();
  });
  
  test("mejorar un área: responde, se recalcula y vuelve con el área abierta", async ({ page }) => {
    await submitIdea(page, "Una app [jev:unknown=acquisition_channel] [gpt:cannot]");
    const before = await getReport(reportIdFrom(page.url()));

    await page.getByRole("button", { name: /Market/ }).click();
    await page.getByRole("button", { name: "Mejorar esta área (1)" }).click();
    await page.getByRole("group", { name: "¿Cómo conseguirás tus clientes?" }).getByLabel("Venta directa").check();
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page).toHaveURL(/\?area=market$/);
    const market = page.getByRole("button", { name: /Market/ });
    await expect(market).toHaveAttribute("aria-expanded", "true");
    await expect(market).toContainText("A favor");
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
    await submitIdea(page, "Una app [jev:unknown=acquisition_channel] [gpt:cannot]");
    const oldTab = await context.newPage();
    await oldTab.goto(page.url());

    for (const tab of [page, oldTab]) {
      await tab.getByRole("button", { name: /Market/ }).click();
      await tab.getByRole("button", { name: "Mejorar esta área (1)" }).click();
      await tab.getByRole("group", { name: "¿Cómo conseguirás tus clientes?" }).getByLabel("Venta directa").check();
    }
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\?area=market$/);

    await oldTab.getByRole("button", { name: "Guardar" }).click();
    await expect(oldTab.getByText("Estas preguntas ya no están pendientes. Recarga la página.")).toBeVisible();
  });

  
  test("el panel muestra los datos del área con su origen", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("button", { name: /Money/ }).click();
    await expect(page.getByText("Datos de esta área")).toBeVisible();
    await expect(page.getByText("Coste de arranque", { exact: true })).toBeVisible();
    await expect(page.getByText("Tú", { exact: true }).first()).toBeVisible();
  });
});


test.describe("editar el informe", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  async function openEditor(page: import("@playwright/test").Page) {
    await page.getByRole("link", { name: "Editar datos" }).click();
    await expect(page.getByRole("heading", { name: "Editar los datos del informe" })).toBeVisible();
  }

  test("un cambio estructural repite el análisis conservando lo del usuario", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await openEditor(page);
    await page.getByRole("group", { name: "¿En qué sector está tu negocio?" }).getByLabel("Hospitality/Food service").check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    const report = await getReport(reportIdFrom(page.url()));
    const sector = report.facts.find((f) => f.key === "sector");
    expect(sector?.value).toBe("Hospitality/Food service");
    expect(sector?.source.origin).toBe("user");
    // Las cifras se han vuelto a estimar.
    expect(report.facts.find((f) => f.key === "startup_cost_eur")?.source.origin).toBe("gpt");
  });

  test("lo que no se toca conserva su origen", async ({ page }) => {
    await submitIdea(page, "Un bar [jev:unknown=competition]");
    await openEditor(page);
    await page.getByLabel("Presupuesto exacto en euros (opcional)").fill("");
    await page.getByRole("group", { name: "¿Hasta dónde ha llegado tu idea?" }).getByLabel("Prototipo").check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
    const report = await getReport(reportIdFrom(page.url()));
    expect(report.facts.find((f) => f.key === "competition")?.source.origin).toBe("gpt");
    expect(report.facts.find((f) => f.key === "validation_stage")?.source.origin).toBe("user");
  });

  test("'Not decided yet' en el presupuesto deja Money sin datos", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await openEditor(page);
    await page.getByRole("group", { name: "¿Cuánto puedes invertir para empezar?" }).getByLabel("Aún no lo he decidido").check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    const money = page.getByRole("button", { name: /Money/ });
    await expect(money).toContainText("Falta información");
  });

  test("un presupuesto exacto que no cuadra con el tramo se rechaza", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await openEditor(page);
    await page.getByRole("group", { name: "¿Cuánto puedes invertir para empezar?" }).getByLabel("Menos de 5.000 €").check();
    await page.getByLabel("Presupuesto exacto en euros (opcional)").fill("40000");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("El presupuesto exacto no cuadra con el tramo elegido.")).toBeVisible();
  });
});

test.describe("decisiones pendientes en las preguntas base", () => {
  test("'Not decided yet' responde la pregunta y no se vuelve a preguntar", async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);

    await submitIdea(page, "Algo [jev:unknown=budget_band]");
    await page.getByRole("group", { name: "¿Cuánto puedes invertir para empezar?" }).getByLabel("Aún no lo he decidido").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Informe de tu idea" })).toBeVisible();
  });
});


test.describe("revisar y aprobar", () => {
  test.beforeEach(async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await login(page, email);
  });

  test("con riesgos se puede continuar igualmente; el aprobado es de solo lectura y se puede reabrir", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("button", { name: "Continuar igualmente" }).click();

    await expect(page.getByText("Aprobado · listo para planificar")).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar datos" })).toHaveCount(0);
    expect((await getReport(reportIdFrom(page.url()))).status).toBe("approved");

    // La página de edición devuelve al informe.
    const reportUrl = page.url();
    await page.goto(`${reportUrl}/editar`);
    await expect(page).toHaveURL(reportUrl);

    await page.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByRole("link", { name: "Editar datos" })).toBeVisible();
    expect((await getReport(reportIdFrom(page.url()))).status).toBe("review");
  });

  test("'Revisar riesgos' abre la primera área en riesgo", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("button", { name: "Revisar lo que hay que trabajar" }).click();
    // Con el Jev falso la fase es "Idea only" (rojo) y Validación va antes que Money en el informe.
    await expect(page.getByRole("button", { name: /Validation/ })).toHaveAttribute("aria-expanded", "true");
  });

  test("una contradicción bloquea la aprobación", async ({ page }) => {
    await submitIdea(page, "Una app de facturación");
    await page.getByRole("link", { name: "Editar datos" }).click();
    await page.getByRole("group", { name: "¿Qué ofreces?" }).getByLabel("Local físico").check();
    await page.getByRole("group", { name: "¿Dónde operará tu negocio?" }).getByLabel("Solo online").check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Hay datos que se contradicen")).toBeVisible();
    await expect(page.getByRole("link", { name: "Corregir datos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar igualmente" })).toHaveCount(0);
  });
});