import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { defaultConfig } from "../../src/lib/plan/config.ts";
import { findCycle } from "../../src/lib/plan/graph.ts";
import { moldGets, moldIssues } from "../../src/lib/plan/mold.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { BUSINESS_STATES, type StateId } from "../../src/lib/plan/states.ts";
import { FIGURE_KEYS } from "../../src/lib/report/areas.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { CATALOG } from "../../src/lib/report/questions.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";

const FACT_STATES = [...Object.keys(CATALOG), ...Object.values(FIGURE_KEYS)].map((key) => `fact:${key}` as StateId);
const ALL_STATES: StateId[] = [...BUSINESS_STATES, ...FACT_STATES];

/** Sin molde genérico todavía. Se vacía tanda a tanda; el test falla si algo de aquí ya está cubierto. */
const PENDING = new Set<StateId>([
  "channel_fit",
  "runway_covered",
  "premises_cost_fit",
  "roles_defined",
  "team_hired",
  "dependency_mitigated",
  "time_secured",
  "founder_gap_covered",
  ...FACT_STATES.filter(
    (state) =>
      !["fact:competition", "fact:differentiator", "fact:startup_cost_eur", "fact:monthly_fixed_costs_eur"].includes(state),
  ),
]);

const generic = (state: StateId) =>
  MOLDS.some((mold) => mold.when === undefined && mold.validationLevel === undefined && moldGets(mold).includes(state));

describe("integridad del catálogo", () => {
  it("todo molde está bien escrito y los ids no se repiten", () => {
    for (const mold of MOLDS) assert.deepEqual(moldIssues(mold), [], mold.id);
    const ids = MOLDS.map((mold) => mold.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("todo estado tiene un molde sin condiciones, salvo los pendientes (y la lista no miente)", () => {
    for (const state of ALL_STATES) {
      if (PENDING.has(state)) assert.ok(!generic(state), `${state} ya está cubierto: quítalo de PENDING`);
      else assert.ok(generic(state), `${state} no tiene molde sin condiciones`);
    }
  });

  it("sin ciclos entre moldes", () => {
    const nodes = MOLDS.map((mold) => ({
      id: mold.id,
      dependsOn: mold.needs.flatMap((need) => MOLDS.filter((other) => moldGets(other).includes(need)).map((other) => other.id)),
    }));
    assert.equal(findCycle(nodes), null);
  });

  it("todos los textos existen en los dos idiomas", () => {
    for (const mold of MOLDS) {
      for (const text of [mold.title, mold.outcome, ...mold.steps.flatMap((step) => [step.text, step.doneWhen])]) {
        assert.ok(text.en.trim() && text.es.trim(), mold.id);
      }
    }
  });
});

describe("de punta a punta: la cafetería de Ana", () => {
  const known = (key: string, value: unknown): Fact => ({
    key,
    value,
    source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
  });
  const facts: Fact[] = [
    known("sector", "Hospitality/Food service"),
    known("offering_type", "Physical venue"),
    known("revenue_model", "One-time sale"),
    known("customer_segment", "Consumers"),
    known("regulatory_load", "Heavy (health, finance, food)"),
    known("validation_stage", "Idea only"),
    known("founder_experience", "Over 5 years"),
    known("time_commitment", "Full time"),
    known("competition", "Few competitors"),
    { key: "budget_eur", value: 10000, source: { origin: "user", quote: "10000" } },
    {
      key: "startup_cost_eur",
      value: { min: 20000, max: 30000 },
      source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: CALIBRATED_JEV_MODEL } },
    },
  ];
  const plan = rebuildPlan({
    report: { facts, verdicts: areaVerdicts(facts), language: "es", fingerprint: "x" },
    config: { ...defaultConfig("2026-10-19", { min: 20, max: 40 }), launchLevel: 1 },
    catalog: MOLDS,
    stored: null,
    today: "2026-10-19",
  });
  const ids = plan.tasks.map((task) => task.id);
  const task = (id: string) => plan.tasks.find((t) => t.id === id)!;

  it("solo quedan sin resolver estados pendientes de próximas tandas", () => {
    for (const issue of plan.issues) {
      const state = /^unreachable (.+)$/.exec(issue)?.[1];
      assert.ok(state && PENDING.has(state as StateId), issue);
    }
  });

  it("sale el plan de una cafetería, sin lo que no le toca", () => {
    for (const id of [
      "interview_customers",
      "demand_test",
      "startup_cost",
      "register_business",
      "find_premises",
      "fit_out",
      "hospitality_licenses",
      "suppliers",
      "offer_pricing",
      "first_customers",
    ]) {
      assert.ok(ids.includes(id), `falta ${id}`);
    }
    for (const id of ["apply_licenses", "build_mvp", "website"]) assert.ok(!ids.includes(id), `sobra ${id}`);
  });

  it("le falta dinero y no se sabe cómo: decidir entre los tres caminos", () => {
    const decision = plan.decisions.find((d) => d.state === "funding_covered");
    assert.deepEqual(decision?.options, ["loan", "partner", "reduce_investment"]);
  });

  it("en buen orden: validar antes que invertir, el local antes que sus licencias y la obra", () => {
    const before = (a: string, b: string) => assert.ok(ids.indexOf(a) < ids.indexOf(b), `${a} antes que ${b}`);
    before("interview_customers", "demand_test");
    before("find_premises", "fit_out");
    before("find_premises", "hospitality_licenses");
    assert.ok(task("hospitality_licenses").dependsOn.includes("register_business"));
    assert.ok(task("first_customers").dependsOn.includes("offer_pricing"));
  });
});