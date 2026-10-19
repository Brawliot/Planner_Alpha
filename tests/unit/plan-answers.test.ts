import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answersFromReplies, planAnswerSchema, type DraftQuestion } from "../../src/lib/plan/answers.ts";

const QUESTIONS: DraftQuestion[] = [
  { id: "a1", mold: "find_premises", text: "¿Cuántas personas sentadas?", options: ["Hasta 10", "10–30"] },
  { id: "a2", mold: "find_premises", text: "¿Tienes zona en mente?", options: ["Sí", "No"] },
];

describe("answersFromReplies", () => {
  it("opción, 'Otra' con texto y 'Aún no lo sé' (null)", () => {
    const answers = answersFromReplies(QUESTIONS, {
      a1: { kind: "option", value: "10–30" },
      a2: { kind: "other", text: "  cerca del mercado  " },
    });
    assert.deepEqual(answers?.map((a) => a.answer), ["10–30", "cerca del mercado"]);
    const unknown = answersFromReplies(QUESTIONS, { a1: { kind: "unknown" }, a2: { kind: "unknown" } });
    assert.deepEqual(unknown?.map((a) => a.answer), [null, null]);
    for (const answer of unknown ?? []) planAnswerSchema.parse(answer);
  });

  it("una opción que no existe, un texto vacío o una pregunta sin contestar: nada", () => {
    assert.equal(answersFromReplies(QUESTIONS, { a1: { kind: "option", value: "Más de 100" }, a2: { kind: "unknown" } }), null);
    assert.equal(answersFromReplies(QUESTIONS, { a1: { kind: "other", text: "   " }, a2: { kind: "unknown" } }), null);
    assert.equal(answersFromReplies(QUESTIONS, { a1: { kind: "unknown" } }), null);
  });
});