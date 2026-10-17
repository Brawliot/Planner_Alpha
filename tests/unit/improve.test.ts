import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL, DONT_KNOW, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import {
  improvementsByArea,
  improveOptions,
  improvePrompt,
  MAX_QUESTIONS_PER_AREA,
  parseImproveAnswers,
} from "../../src/lib/report/improve.ts";
const M = CALIBRATED_JEV_MODEL;

function known(key: string, value: unknown): Fact {
  return { key, value, source: { origin: "jev", model: M, confidence: 0.95, from: "user" } };
}

function estimated(key: string, value: unknown, noul = 0.8): Fact {
  return { key, value, source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul, model: M } } };
}

function questionsOf(area: string, facts: Fact[]) {
  const found = improvementsByArea(facts).find((a) => a.area === area);
  assert.ok(found, `el área ${area} no aparece`);
  return found.questions;
}

describe("improvementsByArea", () => {
  it("un área en Needs info pide primero su dato imprescindible, si es del usuario", () => {
    const questions = questionsOf("market", []);
    assert.equal(questions[0].key, "customer_segment");
    assert.equal(questions[0].reason, "unlock_verdict");
  });

  it("nunca pregunta datos de investigación: competencia, alquiler, regulación...", () => {
    assert.deepEqual(questionsOf("competition", []), []);
    assert.deepEqual(questionsOf("location", [known("offering_type", "Physical venue")]), []);
    assert.deepEqual(questionsOf("regulation", [estimated("regulatory_load", "Heavy (health, finance, food)")]), []);
  });

  it("lo no especificado del usuario también se puede mejorar", () => {
    assert.equal(questionsOf("validation", [known("validation_stage", NOT_SPECIFIED)])[0].key, "validation_stage");
  });

  it("el canal de captación es del usuario: se pregunta si falta", () => {
    const keys = questionsOf("market", [known("customer_segment", "Consumers"), known("geographic_scope", "Local")]).map((q) => q.key);
    assert.deepEqual(keys, ["acquisition_channel"]);
  });

  it("no pregunta lo estimado: se corrige en Edit", () => {
    assert.deepEqual(questionsOf("competition", [estimated("competition", "Crowded market")]), []);
  });

  it("después de lo imprescindible, pregunta lo que falta por concretar", () => {
    const questions = questionsOf("concept", [known("sector", "Other"), known("offering_type", "Software"), known("revenue_model", "Subscription")]);
    assert.deepEqual(questions.map((q) => [q.key, q.reason]), [["differentiator", "complete_area"]]);
  });

  it("no vuelve a preguntar lo que respondió el usuario, aunque fuera 'I don't know'", () => {
    const answered: Fact = { key: "differentiator", value: DONT_KNOW, source: { origin: "user", quote: DONT_KNOW } };
    const questions = questionsOf("concept", [known("sector", "Other"), known("offering_type", "Software"), known("revenue_model", "Subscription"), answered]);
    assert.deepEqual(questions, []);
  });

  it("no pregunta lo que ya es sabido", () => {
    const questions = questionsOf("competition", [known("competition", "Niche with no clear competitors"), known("differentiator", "Price")]);
    assert.deepEqual(questions, []);
  });

  it("nunca pregunta las cifras que estimamos nosotros", () => {
    const keys = questionsOf("money", []).map((q) => q.key);
    assert.equal(keys.includes("startup_cost_eur"), false);
    assert.equal(keys.includes("monthly_fixed_costs_eur"), false);
    assert.equal(keys.includes("budget_eur"), false);
    assert.ok(keys.includes("budget_band"));
  });

  it("como mucho 3 preguntas por área", () => {
    for (const area of improvementsByArea([])) {
      assert.ok(area.questions.length <= MAX_QUESTIONS_PER_AREA, area.area);
    }
  });
});

describe("textos y opciones", () => {
  it("las 'ask' usan el prompt del catálogo y las 'infer' el suyo", () => {
    assert.equal(improvePrompt("budget_band"), "How much can you invest to start?");
    assert.equal(improvePrompt("competition"), "How much competition is there where you will operate?");
  });

  it('las opciones nunca incluyen "Not specified"', () => {
    assert.equal(improveOptions("competition").includes(NOT_SPECIFIED), false);
    assert.ok(improveOptions("competition").includes("Crowded market"));
  });

  it("toda pregunta posible tiene texto propio, no su clave", () => {
    for (const key of ["acquisition_channel", "competition", "capital_intensity", "team_requirement", "time_to_revenue", "regulatory_load", "third_party_dependency", "money_handling", "rent_level"]) {
      assert.notEqual(improvePrompt(key), key, key);
    }
  });
});


describe("parseImproveAnswers", () => {
  const questions = [{ key: "competition", prompt: "p", options: ["Crowded market", "Few competitors"], reason: "unlock_verdict" as const }];
  const form = (values: Record<string, unknown>) => (name: string) => values[name] ?? null;

  it("convierte una respuesta válida en dato del usuario", () => {
    assert.deepEqual(parseImproveAnswers(questions, form({ competition: "Crowded market" })), {
      ok: true,
      facts: [{ key: "competition", value: "Crowded market", source: { origin: "user", quote: "Crowded market" } }],
    });
  });

  it("rechaza una respuesta que falta o inventada", () => {
    assert.equal(parseImproveAnswers(questions, form({})).ok, false);
    assert.equal(parseImproveAnswers(questions, form({ competition: "Mucha" })).ok, false);
  });
});
