import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { aiStepActsOrDecides } from "../../src/lib/plan/concretion-gpt.ts";

describe("la IA solo prepara", () => {
  it("rechaza pasos de la IA que deciden o actúan fuera de la app", () => {
    assert.equal(aiStepActsOrDecides("Elige las redes sociales como canal"), true);
    assert.equal(aiStepActsOrDecides("Publica en redes sociales un anuncio"), true);
    assert.equal(aiStepActsOrDecides("Anúncialo donde están tus clientes"), true);
    assert.equal(aiStepActsOrDecides("Choose a name"), true);
  });

  it("acepta pasos que preparan contenido", () => {
    assert.equal(aiStepActsOrDecides("Prepara 5 preguntas abiertas sobre sus hábitos"), false);
    assert.equal(aiStepActsOrDecides("Redacta el anuncio de apertura"), false);
    assert.equal(aiStepActsOrDecides("Haz una lista de lo que pagarás cada mes"), false);
    assert.equal(aiStepActsOrDecides("Draft the launch announcement"), false);
  });

  it("ningún paso del catálogo que admite IA empieza por un verbo de decidir o actuar", () => {
    const offenders = MOLDS.flatMap((mold) =>
      mold.steps.filter((step) => step.options.ai !== undefined && (aiStepActsOrDecides(step.text.es) || aiStepActsOrDecides(step.text.en))),
    ).map((step) => step.text.es);
    assert.deepEqual(offenders, []);
  });
});