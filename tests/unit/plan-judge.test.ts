import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JevAnswer } from "../../src/lib/jev.ts";
import {
  isGoodQuestion,
  isSpecific,
  judgeState,
  questionQualityQuestions,
  specificityQuestions,
  type DraftTask,
} from "../../src/lib/plan/judge.ts";

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value });

const TASK: DraftTask = {
  id: "t1",
  title: "Confirm and sign the premises",
  outcome: "A signed lease",
  steps: [{ id: "s1", text: "Ask the town hall for a compatibility report" }],
};

describe("especificidad", () => {
  it("una pregunta noul por tarea", () => {
    const questions = specificityQuestions([TASK, { ...TASK, id: "t2" }]);
    assert.deepEqual(Object.keys(questions), ["specific.t1", "specific.t2"]);
    assert.equal(questions["specific.t1"].type, "noul");
  });

  it("el texto de GPT nunca va en las instrucciones, solo en el state", () => {
    for (const question of Object.values(specificityQuestions([TASK]))) {
      assert.ok(!question.instructions.includes(TASK.title));
      assert.ok(!question.instructions.includes(TASK.steps[0].text));
    }
    assert.deepEqual(judgeState("idea", [], { tasks: [TASK] }).target, { tasks: [TASK] });
  });

  it("específica por encima del umbral; genérica por debajo o sin respuesta", () => {
    assert.equal(isSpecific("t1", { "specific.t1": noul(0.45) }), true);
    assert.equal(isSpecific("t1", { "specific.t1": noul(0.2) }), false);
    assert.equal(isSpecific("t1", { "specific.t1": null }), false);
    assert.equal(isSpecific("t1", {}), false);
  });
});


describe("calidad de las preguntas", () => {
  const Q = { id: "a1", text: "¿Tienes una zona en mente?", options: ["Sí", "No"] };

  it("una pregunta noul por propuesta, sin su texto en las instrucciones", () => {
    const questions = questionQualityQuestions([Q]);
    assert.deepEqual(Object.keys(questions), ["question.a1"]);
    assert.ok(!questions["question.a1"].instructions.includes(Q.text));
  });

  it("buena por encima del umbral; mala por debajo o sin respuesta", () => {
    assert.equal(isGoodQuestion("a1", { "question.a1": noul(0.8) }), true);
    assert.equal(isGoodQuestion("a1", { "question.a1": noul(0.2) }), false);
    assert.equal(isGoodQuestion("a1", {}), false);
  });
});