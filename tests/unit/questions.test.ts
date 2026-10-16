import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import {
  answerOptions,
  CATALOG,
  currentStep,
  mergeFacts,
  nextStatus,
  parseAnswers,
  pendingQuestions,
  QUESTION_KEYS,
  type QuestionKey,
} from "../../src/lib/report/questions.ts";

function jevFact(key: string, value: string, confidence: number | null): Fact {
  return { key, value, source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence, from: "user" } };
}

function userFact(key: QuestionKey): Fact {
  const value = answerOptions(key)[0];
  return { key, value, source: { origin: "user", quote: value } };
}

/** Todo el catálogo sabido por Jev, salvo las claves indicadas (que quedan "Not specified"). */
function classified(unknown: QuestionKey[] = []): Fact[] {
  return QUESTION_KEYS.map((key) =>
    unknown.includes(key)
      ? jevFact(key, NOT_SPECIFIED, 0.99)
      : jevFact(key, Object.keys(CATALOG[key].jev.criteria)[0], 0.95),
  );
}

describe("pendingQuestions", () => {
  it("no pregunta lo que ya se sabe", () => {
    assert.deepEqual(pendingQuestions(classified()), []);
  });

  it("pregunta las 'ask' no sabidas y nunca las 'infer'", () => {
    const pending = pendingQuestions(classified(["budget_band", "competition"]));
    assert.deepEqual(pending, ["budget_band"]);
  });

  it("una confianza baja también se pregunta", () => {
    const facts = mergeFacts(classified(), [jevFact("sector", "Other", 0.6)]);
    assert.deepEqual(pendingQuestions(facts), ["sector"]);
  });
});

describe("currentStep", () => {
  it("sin nada pendiente no hay paso", () => {
    assert.equal(currentStep(classified()), null);
  });

  it("devuelve el primer tema con pendientes, solo con sus preguntas pendientes", () => {
    const step = currentStep(classified(["time_commitment", "budget_band"]));
    assert.deepEqual(step, { topic: "founder", title: "You", keys: ["time_commitment"], index: 1, total: 2 });
  });

  it("el progreso es estable: al responder un tema, el siguiente es el 2 de 2", () => {
    const facts = mergeFacts(classified(["time_commitment", "budget_band"]), [userFact("time_commitment")]);
    const step = currentStep(facts);
    assert.equal(step?.topic, "resources");
    assert.equal(step?.index, 2);
    assert.equal(step?.total, 2);
  });

  it("como mucho 3 preguntas por tema y 4 temas", () => {
    const step = currentStep([]);
    assert.equal(step?.keys.length, 3);
    assert.equal(step?.total, 4);
  });
});

describe("answerOptions", () => {
  it('no ofrece "Not specified"', () => {
    assert.equal(answerOptions("geographic_scope").includes(NOT_SPECIFIED), false);
    assert.ok(answerOptions("geographic_scope").includes("Local"));
  });
});

describe("parseAnswers", () => {
  const form = (values: Record<string, unknown>) => (name: string) => values[name] ?? null;

  it("convierte respuestas válidas en datos del usuario", () => {
    const result = parseAnswers(["geographic_scope"], form({ geographic_scope: "Local" }));
    assert.deepEqual(result, {
      ok: true,
      facts: [{ key: "geographic_scope", value: "Local", source: { origin: "user", quote: "Local" } }],
    });
  });

  it("rechaza respuestas que faltan, inventadas o 'Not specified'", () => {
    assert.equal(parseAnswers(["sector"], form({})).ok, false);
    assert.equal(parseAnswers(["sector"], form({ sector: "Hostelería" })).ok, false);
    assert.equal(parseAnswers(["geographic_scope"], form({ geographic_scope: NOT_SPECIFIED })).ok, false);
  });

  it("ignora campos que no son de este paso", () => {
    const result = parseAnswers(["geographic_scope"], form({ geographic_scope: "Local", sector: "Other" }));
    assert.ok(result.ok);
    assert.deepEqual(result.facts.map((f) => f.key), ["geographic_scope"]);
  });
});

describe("nextStatus", () => {
  it("pasa a analysis cuando no quedan preguntas 'ask', aunque falten 'infer'", () => {
    assert.equal(nextStatus(classified(["competition", "regulatory_load"])), "analysis");
    assert.equal(nextStatus(classified(["budget_band"])), "questions");
  });
});