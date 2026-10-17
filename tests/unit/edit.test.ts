import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL, certaintyOf, DONT_KNOW, NOT_DECIDED } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { editFields, parseEdits } from "../../src/lib/report/edit.ts";
import { keysToInfer } from "../../src/lib/report/inference.ts";
import { answerOptions, pendingQuestions } from "../../src/lib/report/questions.ts";

const M = CALIBRATED_JEV_MODEL;

function known(key: string, value: unknown): Fact {
  return { key, value, source: { origin: "jev", model: M, confidence: 0.95, from: "user" } };
}

function estimated(key: string, value: unknown): Fact {
  return { key, value, source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: M } } };
}

const user = (key: string, value: unknown): Fact => ({ key, value, source: { origin: "user", quote: String(value) } });
const form = (values: Record<string, unknown>) => (name: string) => values[name] ?? null;

describe("opciones", () => {
  it("las decisiones admiten 'Not decided yet'; los hechos, no", () => {
    assert.ok(answerOptions("budget_band").includes(NOT_DECIDED));
    assert.equal(answerOptions("sector").includes(NOT_DECIDED), false);
  });

  it("en la edición, las estimaciones admiten 'I don't know'; los hechos, no", () => {
    const fields = editFields([]);
    assert.ok(fields.find((f) => f.key === "competition")?.options.includes(DONT_KNOW));
    assert.equal(fields.find((f) => f.key === "sector")?.options.includes(DONT_KNOW), false);
  });

  it("'Not decided yet' y 'I don't know' son no sabidos", () => {
    assert.equal(certaintyOf(user("budget_band", NOT_DECIDED)), "unknown");
    assert.equal(certaintyOf(user("competition", DONT_KNOW)), "unknown");
  });
});

describe("no se vuelve a preguntar ni a estimar lo que respondió el usuario", () => {
  it("'Not decided yet' cuenta como respondida", () => {
    assert.equal(pendingQuestions([user("budget_band", NOT_DECIDED)]).includes("budget_band"), false);
  });

  it("'I don't know' no se vuelve a inferir", () => {
    assert.equal(keysToInfer([user("competition", DONT_KNOW)]).includes("competition"), false);
  });
});

describe("parseEdits", () => {
  const facts = [known("sector", "Technology/SaaS"), estimated("competition", "Crowded market"), known("budget_band", "€20k-€50k")];

  it("lo que no cambia no se guarda (un estimado sigue siendo estimado)", () => {
    const result = parseEdits(facts, form({ sector: "Technology/SaaS", competition: "Crowded market" }));
    assert.deepEqual(result, { ok: true, changes: [], structural: false });
  });

  it("lo que cambia pasa a ser dato del usuario; el sector es estructural", () => {
    const result = parseEdits(facts, form({ sector: "Hospitality/Food service" }));
    assert.ok(result.ok);
    assert.deepEqual(result.changes, [user("sector", "Hospitality/Food service")]);
    assert.equal(result.structural, true);
  });

  it("retirar una estimación con 'I don't know' no es estructural", () => {
    const result = parseEdits(facts, form({ competition: DONT_KNOW }));
    assert.ok(result.ok);
    assert.equal(result.structural, false);
  });

  it("rechaza opciones inventadas o 'I don't know' en un hecho", () => {
    assert.deepEqual(parseEdits(facts, form({ sector: "Bares" })), { ok: false, error: "invalid" });
    assert.deepEqual(parseEdits(facts, form({ sector: DONT_KNOW })), { ok: false, error: "invalid" });
  });

  it("el presupuesto exacto tiene que cuadrar con el tramo", () => {
    assert.deepEqual(parseEdits(facts, form({ budget_eur: "400000" })), { ok: false, error: "inconsistent_budget" });
    const ok = parseEdits(facts, form({ budget_eur: "40000" }));
    assert.ok(ok.ok);
    assert.deepEqual(ok.changes, [user("budget_eur", 40000)]);
  });

  it("rechaza un presupuesto que no es un entero válido", () => {
    assert.deepEqual(parseEdits(facts, form({ budget_eur: "-5" })), { ok: false, error: "invalid" });
    assert.deepEqual(parseEdits(facts, form({ budget_eur: "abc" })), { ok: false, error: "invalid" });
  });
});