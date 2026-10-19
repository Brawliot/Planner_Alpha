import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JevAnswer } from "../../src/lib/jev.ts";
import { COST_BAND_KEYS, EFFORT_BAND_KEYS, WAIT_BAND_KEYS } from "../../src/lib/plan/bands.ts";
import {
  COMPLEXITY_QUESTION,
  judgeState,
  nearMass,
  readComplexity,
  readReview,
  reviewQuestions,
  type DraftTask,
} from "../../src/lib/plan/judge.ts";

const choice = (value: string, confidence = 0.95): JevAnswer => ({
  type: "choice",
  choice: value,
  probabilities: { [value]: 1 },
  confidence,
});
const noul = (value: number): JevAnswer => ({ type: "noul", noul: value });

const TASK: DraftTask = {
  id: "t1",
  title: "Confirm and sign the premises",
  outcome: "A signed lease",
  steps: [
    { id: "s1", text: "Ask the town hall for a compatibility report", actors: ["user", "third_party"] },
    { id: "s2", text: "Sign", actors: ["user"] },
  ],
};

/** Respuestas seguras para todo, con cambios puntuales. */
const answersFor = (changes: Record<string, JevAnswer | null> = {}) => ({
  "specific.t1": noul(0.9),
  "effort.t1.s1.user": choice("1_4h"),
  "cost.t1.s1.user": choice("under_100"),
  "effort.t1.s1.third_party": choice("under_1h"),
  "cost.t1.s1.third_party": choice("100_500"),
  "wait.t1.s1.third_party": choice("1_4w"),
  "effort.t1.s2.user": choice("4_8h"),
  "cost.t1.s2.user": choice("free"),
  ...changes,
});

describe("preguntas a Jev", () => {
  it("complejidad: baja, media o alta", () => {
    assert.deepEqual(Object.keys(COMPLEXITY_QUESTION.criteria), ["low", "medium", "high"]);
  });

  it("especificidad por tarea; horas y euros por paso y actor; espera solo con tercero", () => {
    assert.deepEqual(Object.keys(reviewQuestions([TASK])).sort(), Object.keys(answersFor()).sort());
  });

  it("las opciones son exactamente los tramos fijos", () => {
    const questions = reviewQuestions([TASK]);
    const options = (k: string) => {
      const q = questions[k];
      return q.type === "choice" ? Object.keys(q.criteria) : [];
    };
    assert.deepEqual(options("effort.t1.s1.user"), EFFORT_BAND_KEYS);
    assert.deepEqual(options("cost.t1.s1.user"), COST_BAND_KEYS);
    assert.deepEqual(options("wait.t1.s1.third_party"), WAIT_BAND_KEYS);
  });

  it("el texto de GPT nunca va en las instrucciones, solo en el state", () => {
    for (const question of Object.values(reviewQuestions([TASK]))) {
      assert.ok(!question.instructions.includes(TASK.steps[0].text));
      assert.ok(!question.instructions.includes(TASK.title));
    }
    const state = judgeState("idea", [], { tasks: [TASK] });
    assert.deepEqual(state.target, { tasks: [TASK] });
  });
});

describe("lectura de respuestas", () => {
  it("complejidad: con confianza baja u opción inventada, no se sabe", () => {
    assert.equal(readComplexity(choice("medium")), "medium");
    assert.equal(readComplexity(choice("medium", 0.6)), null);
    assert.equal(readComplexity(choice("huge")), null);
    assert.equal(readComplexity(null), null);
  });

  it("todo seguro y específica: pasa con los rangos de sus tramos", () => {
    const [review] = readReview([TASK], answersFor());
    assert.equal(review.ok, true);
    assert.deepEqual(review.steps.s1.third_party, {
      effort: { min: 0.25, max: 1 },
      cost: { min: 100, max: 500 },
      wait: { min: 7, max: 28 },
      widened: false,
    });
    assert.deepEqual(review.steps.s2.user, { effort: { min: 4, max: 8 }, cost: { min: 0, max: 0 }, widened: false });
  });

  it("dudoso entre vecinos: se amplía al tramo y sus vecinos, sin descartar", () => {
    const doubtful: JevAnswer = {
      type: "choice",
      choice: "1_4w",
      probabilities: { under_1w: 0.3, "1_4w": 0.4, "1_3m": 0.3 },
      confidence: 0.4,
    };
    assert.equal(nearMass(doubtful, ["under_1w", "1_4w", "1_3m", "3_6m"]), 1);
    const [review] = readReview([TASK], answersFor({ "wait.t1.s1.third_party": doubtful }));
    assert.equal(review.ok, true);
    assert.deepEqual(review.steps.s1.third_party?.wait, { min: 1, max: 90 });
    assert.equal(review.steps.s1.third_party?.widened, true);
  });

  it("genérica: se descarta", () => {
    // Por debajo de SPECIFIC_MIN_NOUL (0,30): genérica.
    assert.deepEqual(readReview([TASK], answersFor({ "specific.t1": noul(0.2) }))[0].reason, "generic");
  });

  it("muy dudoso o sin respuesta: se descarta la tarea entera", () => {
    const scattered: JevAnswer = {
      type: "choice",
      choice: "1_4w",
      probabilities: { "1_4w": 0.3, "3_6m": 0.7 },
      confidence: 0.3,
    };
    assert.equal(readReview([TASK], answersFor({ "wait.t1.s1.third_party": scattered }))[0].reason, "unsure_band");
    assert.equal(readReview([TASK], answersFor({ "cost.t1.s2.user": null }))[0].reason, "unsure_band");
  });
});