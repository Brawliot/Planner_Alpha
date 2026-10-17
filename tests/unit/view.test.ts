import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { footerState, reportView } from "../../src/lib/report/view.ts";
import type { AreaVerdict } from "../../src/lib/report/verdict.ts";

const M = CALIBRATED_JEV_MODEL;

function estimated(key: string, value: unknown, assumptions: string[]): Fact {
  return { key, value, source: { origin: "gpt", model: "gpt", assumptions, plausibility: { noul: 0.8, model: M } } };
}

const v = (verdict: AreaVerdict["verdict"]) => ({ verdict }) as AreaVerdict;

describe("footerState", () => {
  it("faltan datos manda sobre los riesgos; si no, riesgos; si no, todo bien", () => {
    assert.equal(footerState([v("risk"), v("needs_info")]), "missing_data");
    assert.equal(footerState([v("strong"), v("risk")]), "risks");
    assert.equal(footerState([v("strong"), v("strong")]), "all_good");
  });
});

describe("reportView", () => {
  const budget: Fact = { key: "budget_eur", value: 40000, source: { origin: "user", quote: "40.000 €" } };
  const facts = [
    budget,
    estimated("startup_cost_eur", { min: 45000, max: 60000 }, ["Local de 80 m²", "Reforma media"]),
    estimated("monthly_fixed_costs_eur", { min: 3000, max: 5000 }, ["Reforma media", "Dos empleados", "Alquiler céntrico"]),
  ];

  it("sin narrativa usa plantillas en inglés", () => {
    const view = reportView("idea", facts, null);
    assert.equal(view.language, "en");
    const money = view.areas.find((a) => a.area === "money");
    assert.equal(money?.sentence, "Your budget doesn't cover the minimum estimated cost to open.");
  });

  it("los supuestos del área estimada, sin repetidos y como mucho 3", () => {
    const money = reportView("idea", facts, null).areas.find((a) => a.area === "money");
    assert.equal(money?.estimated, true);
    assert.deepEqual(money?.assumptions, ["Local de 80 m²", "Reforma media", "Dos empleados"]);
  });

  it("las áreas sin estimaciones no llevan supuestos", () => {
    const concept = reportView("idea", facts, null).areas.find((a) => a.area === "concept");
    assert.deepEqual(concept?.assumptions, []);
  });

  it("la vista no contiene datos internos", () => {
    const json = JSON.stringify(reportView("idea", facts, null));
    for (const internal of ["confidence", "plausibility", "origin", M]) assert.equal(json.includes(internal), false, internal);
  });
});


describe("datos de cada área", () => {
  const facts: Fact[] = [
    { key: "budget_eur", value: 60000, source: { origin: "user", quote: "60.000 €" } },
    estimated("startup_cost_eur", { min: 70000, max: 200000 }, ["Local de 80 m²"]),
    estimated("monthly_fixed_costs_eur", { min: 9000, max: 16000 }, []),
  ];

  it("muestra el valor formateado y si es tuyo o estimado, en el idioma del informe", () => {
    const narrative = { language: "es" as const, areas: {}, risks: [], fingerprints: {} };
    const money = reportView("idea", facts, narrative).areas.find((a) => a.area === "money");
    const byKey = Object.fromEntries((money?.data ?? []).map((d) => [d.key, d]));
    assert.equal(byKey.budget_eur.label, "Presupuesto");
    assert.equal(byKey.budget_eur.estimated, false);
    assert.match(byKey.budget_eur.value, /60\.000/);
    assert.equal(byKey.startup_cost_eur.estimated, true);
    assert.match(byKey.monthly_fixed_costs_eur.value, /\/mes$/);
  });

  it("no muestra lo no sabido", () => {
    const money = reportView("idea", facts, null).areas.find((a) => a.area === "money");
    assert.equal(money?.data.some((d) => d.key === "time_to_revenue"), false);
  });
});

describe("por concretar", () => {
  const jev = (key: string, value: string): Fact => ({
    key,
    value,
    source: { origin: "jev", model: M, confidence: 0.95, from: "user" },
  });

  it("cada área lista lo que no se sabe con su nombre legible, sin cambiar el color", () => {
    const view = reportView("Una app", [jev("offering_type", "Software"), jev("revenue_model", "Subscription")], null);
    const concept = view.areas.find((a) => a.area === "concept");
    assert.equal(concept?.verdict, "strong");
    assert.deepEqual(concept?.pending.map((p) => p.label), ["Sector", "What sets you apart"]);
  });

  it("un área en gris lista primero lo imprescindible que falta", () => {
    const view = reportView("Una app", [], null);
    const founder = view.areas.find((a) => a.area === "founder");
    assert.equal(founder?.verdict, "needs_info");
    assert.deepEqual(founder?.pending.slice(0, 2).map((p) => p.key), ["founder_experience", "time_commitment"]);
  });
});