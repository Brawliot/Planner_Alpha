import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import {
  answerOptions,
  mergeFacts,
  nextStatus,
  parseAnswers,
  pendingQuestions,
} from "../../src/lib/report/questions.ts";

function jevFact(key: string, value: string, confidence: number | null): Fact {
  return { key, value, source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence, from: "user" } };
}

const ALL_KNOWN: Fact[] = [
  jevFact("sector", "Hospitality/Food service", 0.95),
  jevFact("geographic_scope", "Local", 0.9),
  jevFact("validation_stage", "Idea only", 0.88),
];

describe("pendingQuestions", () => {
  it("no pregunta lo que ya se sabe", () => {
    assert.deepEqual(pendingQuestions(ALL_KNOWN), []);
  });

  it("pregunta lo de confianza baja, lo no especificado y lo que falta", () => {
    const facts = [
      jevFact("sector", "Hospitality/Food service", 0.6),
      jevFact("geographic_scope", NOT_SPECIFIED, 0.99),
    ];
    assert.deepEqual(pendingQuestions(facts), ["sector", "geographic_scope", "validation_stage"]);
  });

  it("una respuesta del usuario cuenta como sabida", () => {
    const facts = mergeFacts(ALL_KNOWN, [{ key: "sector", value: "Other", source: { origin: "user", quote: "Other" } }]);
    assert.deepEqual(pendingQuestions(facts), []);
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

  it("ignora campos que no son preguntas pendientes", () => {
    const result = parseAnswers(["geographic_scope"], form({ geographic_scope: "Local", sector: "Other" }));
    assert.ok(result.ok);
    assert.deepEqual(result.facts.map((f) => f.key), ["geographic_scope"]);
  });
});

describe("mergeFacts y nextStatus", () => {
  it("sustituye solo las claves respondidas", () => {
    const merged = mergeFacts(ALL_KNOWN, [{ key: "sector", value: "Other", source: { origin: "user", quote: "Other" } }]);
    assert.equal(merged.length, 3);
    assert.equal(merged.find((f) => f.key === "sector")?.value, "Other");
  });

  it("pasa a review cuando no quedan preguntas", () => {
    assert.equal(nextStatus(ALL_KNOWN), "review");
    assert.equal(nextStatus([]), "questions");
  });
});