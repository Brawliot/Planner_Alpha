import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { defaultConfig } from "../../src/lib/plan/config.ts";
import { findCycle } from "../../src/lib/plan/graph.ts";
import { PERSONAL_KEYS } from "../../src/lib/plan/goals.ts";
import { moldGets, moldIssues } from "../../src/lib/plan/mold.ts";
import { buildSkeleton } from "../../src/lib/plan/engine.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { BUSINESS_STATES, type StateId } from "../../src/lib/plan/states.ts";
import { FIGURE_KEYS } from "../../src/lib/report/areas.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { CATALOG } from "../../src/lib/report/questions.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";

const FACT_STATES = [...Object.keys(CATALOG), ...Object.values(FIGURE_KEYS)].map((key) => `fact:${key}` as StateId);
const ALL_STATES: StateId[] = [...BUSINESS_STATES, ...FACT_STATES];

/** Datos personales: no son tareas del plan, se completan en el informe. */
const PERSONAL = new Set<StateId>(PERSONAL_KEYS.map((key) => `fact:${key}` as StateId));

const generic = (state: StateId) =>
  MOLDS.some((mold) => mold.when === undefined && mold.validationLevel === undefined && moldGets(mold).includes(state));

describe("integridad del catálogo", () => {
  it("todo molde está bien escrito y los ids no se repiten", () => {
    for (const mold of MOLDS) assert.deepEqual(moldIssues(mold), [], mold.id);
    const ids = MOLDS.map((mold) => mold.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("todo estado tiene un molde sin condiciones, salvo los datos personales", () => {
    for (const state of ALL_STATES) {
      if (!PERSONAL.has(state)) assert.ok(generic(state), `${state} no tiene molde sin condiciones`);
    }
  });

  it("lo del fundador va primero: acelera todo lo demás", () => {
    assert.deepEqual(
      MOLDS.slice(0, 4).map((mold) => mold.id),
      ["plan_time", "cofounder", "learn_sector", "mentor"],
    );
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

  it("no queda nada sin resolver", () => {
    assert.deepEqual(plan.issues, []);
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
    before("rent_research", "find_premises");
    before("fit_out", "first_customers");
    before("hospitality_licenses", "first_customers");
    before("suppliers", "first_customers");
    assert.ok(task("find_premises").lineId.startsWith("base:operations"), "el local va en Operaciones");
    assert.ok(task("hospitality_licenses").dependsOn.includes("register_business"));
    assert.ok(task("first_customers").dependsOn.includes("offer_pricing"));
  });
});


describe("caminos específicos de la tanda 2", () => {
  const known = (key: string, value: string): Fact => ({
    key,
    value,
    source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
  });
  const red = (area: "regulation" | "market", reason: string) => ({
    area,
    verdict: "risk" as const,
    reason,
    missing: [],
    gaps: [],
    estimated: false,
  });
  const skeleton = (facts: Fact[], verdicts: ReturnType<typeof red>[]) =>
    buildSkeleton({
      facts,
      verdicts,
      config: { ...defaultConfig("2026-10-19", { min: 10, max: 20 }), launchLevel: 1 },
      catalog: MOLDS,
      achieved: [],
      language: "es",
    });

  it("custodiar dinero: proveedor regulado o licencia, con el proveedor como provisional", () => {
    const plan = skeleton([known("money_handling", "Holds or intermediates funds")], [red("regulation", "regulation.holds_funds")]);
    const decision = plan.decisions.find((d) => d.state === "licenses_granted");
    assert.deepEqual(decision?.options, ["payment_provider", "payment_license"]);
    assert.equal(decision?.chosen, "payment_provider");
  });

  it("vender a la administración gana al canal genérico", () => {
    const plan = skeleton([known("customer_segment", "Public sector")], [red("market", "market.risk")]);
    const ids = plan.tasks.map((t) => t.id);
    assert.ok(ids.includes("public_sector_sales"));
    assert.ok(!ids.includes("choose_channel"));
  });
});