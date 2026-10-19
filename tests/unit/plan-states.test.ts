import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig } from "../../src/lib/plan/config.ts";
import { BUSINESS_STATES, BUSINESS_STATE_LABELS, MILESTONE_STATES, currentStates } from "../../src/lib/plan/states.ts";
import { MILESTONES } from "../../src/lib/plan/task.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";

const known = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});
const estimated = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: CALIBRATED_JEV_MODEL } },
});

const config = (done: (typeof MILESTONES)[number][] = []) => ({ ...defaultConfig("2026-10-19", { min: 10, max: 20 }), done });
const states = (facts: Fact[], done: (typeof MILESTONES)[number][] = []) =>
  currentStates({ facts, config: config(done), achieved: [] });

describe("estados del plan", () => {
  it("un dato sabido del informe es un estado de conocimiento; el estimado no", () => {
    const result = states([known("competition", "Crowded market"), estimated("budget_band", "Not decided yet")]);
    assert.deepEqual(result.get("fact:competition"), { kind: "report", key: "competition" });
    assert.equal(result.has("fact:budget_band"), false);

    const guess = states([estimated("competition", "Crowded market")]);
    assert.equal(guess.has("fact:competition"), false);
  });

  it("la fase de validación sabida da sus estados de negocio", () => {
    const result = states([known("validation_stage", "Generating revenue")]);
    for (const state of ["problem_confirmed", "mvp_ready", "demand_tested", "first_customers", "price_tested"] as const) {
      assert.deepEqual(result.get(state), { kind: "report", key: "validation_stage" });
    }
  });

  it("un prototipo confirma el problema pero no da por construida la primera versión", () => {
    const result = states([known("validation_stage", "Prototype")]);
    assert.equal(result.has("problem_confirmed"), true);
    assert.equal(result.has("mvp_ready"), false);
  });

  it("una validación estimada no hace verdad nada", () => {
    const result = states([estimated("validation_stage", "Growing")]);
    assert.equal(result.has("demand_tested"), false);
  });

  it("la diferenciación cuenta salvo que se sepa que no hay ninguna", () => {
    assert.equal(states([known("differentiator", "Quality or experience")]).has("differentiator_defined"), true);
    assert.equal(states([known("differentiator", "None identified")]).has("differentiator_defined"), false);
  });

  it("cada hito marcado da su estado, incluidos los nuevos", () => {
    const result = states([], ["premises", "funding", "suppliers", "licenses"]);
    assert.deepEqual(result.get("premises_ready"), { kind: "milestone", milestone: "premises" });
    assert.deepEqual(result.get("funding_covered"), { kind: "milestone", milestone: "funding" });
    assert.equal(result.has("suppliers_chosen"), true);
    assert.equal(result.has("licenses_granted"), true);
  });

  it("las tareas terminadas añaden lo que consiguen", () => {
    const result = currentStates({
      facts: [],
      config: config(),
      achieved: [{ state: "competitors_mapped", taskId: "t1" }],
    });
    assert.deepEqual(result.get("competitors_mapped"), { kind: "plan", taskId: "t1" });
  });

  it("con varios orígenes se queda el primero: informe, luego hito, luego tarea", () => {
    const result = currentStates({
      facts: [known("validation_stage", "MVP with customers")],
      config: config(),
      achieved: [{ state: "mvp_ready", taskId: "t1" }],
    });
    assert.deepEqual(result.get("mvp_ready"), { kind: "report", key: "validation_stage" });
  });

  it("todo hito tiene estado y todo estado de negocio tiene texto en los dos idiomas", () => {
    for (const milestone of MILESTONES) assert.ok(BUSINESS_STATES.includes(MILESTONE_STATES[milestone]));
    for (const state of BUSINESS_STATES) {
      assert.ok(BUSINESS_STATE_LABELS[state].en.length > 0);
      assert.ok(BUSINESS_STATE_LABELS[state].es.length > 0);
    }
  });
});