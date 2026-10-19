import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JevAnswer } from "../../src/lib/jev.ts";
import { isSpecific, judgeState, specificityQuestions, type DraftTask } from "../../src/lib/plan/judge.ts";

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