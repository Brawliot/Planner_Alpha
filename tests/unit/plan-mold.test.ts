import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig } from "../../src/lib/plan/config.ts";
import { moldApplies, moldFit, moldGets, moldIssues, stepsAt, type Mold, type MoldStep } from "../../src/lib/plan/mold.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { option } from "../../src/lib/report/verdict.ts";

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

const text = (s: string) => ({ en: s, es: s });
const config = (changes: Partial<ReturnType<typeof defaultConfig>> = {}) => ({
  ...defaultConfig("2026-10-19", { min: 10, max: 20 }),
  ...changes,
});

const step = (id: string, extra: Partial<MoldStep> = {}): MoldStep => ({
  id,
  text: text(id),
  doneWhen: text(id),
  suggestedActor: "user",
  options: { user: { effort: "1_4h" } },
  ...extra,
});

/** Web: página sencilla en nivel 1, reservas en nivel 3. */
const website: Mold = {
  id: "website",
  department: "sales",
  phase: "launch",
  kind: "action",
  title: text("Website"),
  outcome: text("Website"),
  needs: ["brand_ready"],
  gets: ["website_ready"],
  steps: [
    step("page"),
    step("bookings", { level: 3, dependsOn: ["page"] }),
    step("publish", { dependsOn: ["page", "bookings"] }),
  ],
};

const sanitary: Mold = {
  ...website,
  id: "sanitary",
  department: "legal",
  needs: [],
  gets: ["licenses_granted"],
  when: { facts: [{ key: "regulatory_load", anyOf: [option("regulatory_load", "Heavy (health, finance, food)")] }] },
  steps: [step("apply")],
};

describe("moldApplies", () => {
  it("solo si el dato es sabido y coincide", () => {
    const heavy = "Heavy (health, finance, food)";
    assert.equal(moldApplies(sanitary, [known("regulatory_load", heavy)], config()), true);
    assert.equal(moldApplies(sanitary, [estimated("regulatory_load", heavy)], config()), false);
    assert.equal(moldApplies(sanitary, [], config()), false);
  });

  it("un 'no lo sé' de la configuración nunca coincide", () => {
    const employed: Mold = { ...website, when: { employed: true } };
    assert.equal(moldApplies(employed, [], config({ employed: true })), true);
    assert.equal(moldApplies(employed, [], config({ employed: null })), false);
  });

  it("respeta el nivel de validación", () => {
    const deep: Mold = { ...website, validationLevel: 3 };
    assert.equal(moldApplies(deep, [], config({ validationLevel: 2 })), false);
    assert.equal(moldApplies(deep, [], config({ validationLevel: 3 })), true);
  });
});

describe("stepsAt", () => {
  it("nivel 1: sin reservas, y publicar ya no espera a un paso que no está", () => {
    const steps = stepsAt(website, config({ launchLevel: 1 }));
    assert.deepEqual(steps.map((s) => s.id), ["page", "publish"]);
    assert.deepEqual(steps[1].dependsOn, ["page"]);
  });

  it("nivel 3: todos los pasos", () => {
    assert.equal(stepsAt(website, config({ launchLevel: 3 })).length, 3);
  });

  it("en la fase Validar manda el nivel de validación", () => {
    const survey: Mold = { ...website, phase: "validate", steps: [step("a"), step("b", { level: 2 })] };
    assert.equal(stepsAt(survey, config({ validationLevel: 1, launchLevel: 3 })).length, 1);
  });
});

describe("moldGets y moldFit", () => {
  it("el dato que resuelve se añade a lo que consigue, sin repetir", () => {
    const research: Mold = { ...website, gets: ["competitors_mapped"], unlocks: ["competition", "differentiator"] };
    assert.deepEqual(moldGets(research), ["competitors_mapped", "fact:competition", "fact:differentiator"]);
    assert.deepEqual(moldGets({ ...research, gets: ["fact:competition"] }), ["fact:competition", "fact:differentiator"]);
  });

  it("puntúa las reglas que encajan y da sus motivos", () => {
    const smaller: Mold = {
      ...website,
      fit: [
        { when: { employed: true }, reason: text("keeps job") },
        { when: { hasNetwork: false }, reason: text("no contacts") },
      ],
    };
    const fit = moldFit(smaller, [], config({ employed: true, hasNetwork: true }));
    assert.equal(fit.score, 1);
    assert.deepEqual(fit.reasons, [text("keeps job")]);
  });
});

describe("moldIssues", () => {
  it("un molde bien escrito no tiene problemas", () => {
    assert.deepEqual(moldIssues(website), []);
    assert.deepEqual(moldIssues(sanitary), []);
  });

  it("detecta lo mal escrito", () => {
    const bad: Mold = {
      ...website,
      needs: ["website_ready"],
      steps: [
        step("a", { level: 2, dependsOn: ["b"] }),
        step("b", { dependsOn: ["a"], level: 3 }),
        step("c", { suggestedActor: "ai" }),
        step("d", { options: {} }),
        step("d", { dependsOn: ["ghost"] }),
      ],
    };
    const issues = moldIssues(bad);
    for (const expected of [
      "needs what it gets: website_ready",
      "duplicate step id",
      "unknown step dependency d → ghost",
      "step dependency cycle",
      "step c suggests an actor without figures",
      "step d has no actor",
    ]) {
      assert.ok(issues.includes(`website: ${expected}`), `falta: ${expected}`);
    }
  });

  it("necesita al menos un paso de nivel 1 y conseguir algo", () => {
    const issues = moldIssues({ ...website, gets: [], steps: [step("x", { level: 2 })] });
    assert.ok(issues.includes("website: gets nothing"));
    assert.ok(issues.includes("website: no step at level 1"));
  });
});