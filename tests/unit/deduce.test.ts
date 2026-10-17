import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL, CANT_TELL, certaintyOf, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
import { CLASSIFY_QUESTIONS, combineClassification, LIKELY_PREFIX } from "../../src/lib/report/deduce.ts";
import { LIKELY_KEYS, QUESTION_KEYS } from "../../src/lib/report/questions.ts";

const M = CALIBRATED_JEV_MODEL;
const answer = (choice: string, confidence: number) => ({ type: "choice" as const, choice, probabilities: {}, confidence });

function factOf(answers: Parameters<typeof combineClassification>[0], key: string) {
  const fact = combineClassification(answers, M).find((f) => f.key === key);
  assert.ok(fact);
  return fact;
}

describe("CLASSIFY_QUESTIONS", () => {
  it("lleva las 20 'dicho' y una 'probable' por cada dimensión deducible", () => {
    assert.equal(Object.keys(CLASSIFY_QUESTIONS).length, QUESTION_KEYS.length + LIKELY_KEYS.length);
    for (const key of LIKELY_KEYS) assert.ok(Object.hasOwn(CLASSIFY_QUESTIONS, `${LIKELY_PREFIX}${key}`), key);
  });
});

describe("combineClassification", () => {
  it("devuelve un dato por dimensión", () => {
    assert.equal(combineClassification({}, M).length, QUESTION_KEYS.length);
  });

  it("lo dicho con seguridad gana a lo probable", () => {
    const fact = factOf({ revenue_model: answer("Subscription", 0.95), likely_revenue_model: answer("Commission", 0.99) }, "revenue_model");
    assert.equal(fact.value, "Subscription");
    assert.equal(certaintyOf(fact), "known");
  });

  it("si no lo dice, usa la deducción segura como estimada", () => {
    const fact = factOf({ revenue_model: answer(NOT_SPECIFIED, 0.99), likely_revenue_model: answer("Commission", 0.9) }, "revenue_model");
    assert.equal(fact.value, "Commission");
    assert.equal(certaintyOf(fact), "estimated");
  });

  it("'Can't tell' o una deducción floja dejan el dato sin saber", () => {
    for (const likely of [answer(CANT_TELL, 0.99), answer("Commission", 0.5)]) {
      const fact = factOf({ revenue_model: answer(NOT_SPECIFIED, 0.99), likely_revenue_model: likely }, "revenue_model");
      assert.equal(certaintyOf(fact), "unknown");
    }
  });

  it("las dimensiones personales nunca se deducen", () => {
    assert.equal(LIKELY_KEYS.includes("budget_band"), false);
    const fact = factOf({ budget_band: answer(NOT_SPECIFIED, 0.99), likely_budget_band: answer("x", 0.99) }, "budget_band");
    assert.equal(certaintyOf(fact), "unknown");
  });
});