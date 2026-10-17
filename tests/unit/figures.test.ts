import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import {
  budgetMatchesBand,
  figureFacts,
  figuresFormat,
  figuresParser,
  rangesToEstimate,
  type FiguresResult,
} from "../../src/lib/report/figures.ts";
import { moneyCheck } from "../../src/lib/report/money.ts";

const M = CALIBRATED_JEV_MODEL;

function known(key: string, value: unknown): Fact {
  return { key, value, source: { origin: "jev", model: M, confidence: 0.95, from: "user" } };
}

function estimatedRange(key: string, min: number, max: number, noul = 0.8): Fact {
  return { key, value: { min, max }, source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul, model: M } } };
}

function result(ranges: FiguresResult["ranges"] = {}): FiguresResult {
  return { ranges };
}

describe("rangesToEstimate", () => {
  it("coste de arranque y gastos fijos siempre; alquiler solo en local físico", () => {
    assert.deepEqual(rangesToEstimate([]), ["startup_cost_eur", "monthly_fixed_costs_eur"]);
    assert.deepEqual(rangesToEstimate([known("offering_type", "Physical venue")]), [
      "startup_cost_eur",
      "monthly_fixed_costs_eur",
      "monthly_rent_eur",
    ]);
  });

  it("no vuelve a estimar lo que ya existe", () => {
    assert.deepEqual(rangesToEstimate([estimatedRange("startup_cost_eur", 1, 2)]), ["monthly_fixed_costs_eur"]);
  });
});

describe("figuresFormat", () => {
  it("cumple Structured Outputs estricto: todo required y additionalProperties false", () => {
    const { schema } = figuresFormat(["startup_cost_eur"]);
    assert.deepEqual(schema.required, ["ranges"]);
    assert.equal(Object.hasOwn(schema.properties, "budget"), false, "GPT ya no extrae el presupuesto");
    assert.equal(schema.additionalProperties, false);
    const ranges = schema.properties.ranges as { required: string[] };
    assert.deepEqual(ranges.required, ["startup_cost_eur"]);
  });
});

describe("nivel de alquiler", () => {
  it("el esquema solo lo pide para locales físicos", () => {
    assert.equal(Object.hasOwn(figuresFormat(["startup_cost_eur"]).schema.properties, "rent_level"), false);
    const { schema } = figuresFormat(["startup_cost_eur"], true);
    assert.ok(schema.required.includes("rent_level"));
  });

  it("crea el dato con origen GPT y omite 'Cannot estimate'", () => {
    const base = { ranges: {} };
    const facts = figureFacts({ ...base, rent_level: { value: "Prime location", assumptions: ["Gran Vía"] } }, [], "gpt");
    assert.deepEqual(facts, [
      { key: "rent_level", value: "Prime location", source: { origin: "gpt", model: "gpt", assumptions: ["Gran Vía"] } },
    ]);
    assert.deepEqual(figureFacts({ ...base, rent_level: { value: "Cannot estimate", assumptions: [] } }, [], "gpt"), []);
  });

  it("el parser rechaza un nivel inventado", () => {
    const parser = figuresParser([], true);
    const bad = parser.safeParse({ ranges: {}, rent_level: { value: "Carísimo", assumptions: [] } });
    assert.equal(bad.success, false);
  });
});


describe("figuresParser", () => {
  const parser = figuresParser(["startup_cost_eur"]);

  it("un rango incoherente o negativo pasa a null sin rechazar todo", () => {
    const inverted = parser.parse({ ranges: { startup_cost_eur: { min: 9000, max: 100, assumptions: [] } } });
    assert.equal(inverted.ranges.startup_cost_eur, null);

    const negative = parser.parse({ ranges: { startup_cost_eur: { min: -1, max: 100, assumptions: [] } } });
    assert.equal(negative.ranges.startup_cost_eur, null);
  });
});

describe("figureFacts", () => {
  it("los rangos salen con origen GPT, y los nulos no generan dato", () => {
    const facts = figureFacts(
      result({ startup_cost_eur: { min: 60000, max: 120000, assumptions: ["80 m²"] }, monthly_fixed_costs_eur: null }),
      ["startup_cost_eur", "monthly_fixed_costs_eur"],
      "gpt-6.1-sol",
    );
    assert.deepEqual(facts, [
      {
        key: "startup_cost_eur",
        value: { min: 60000, max: 120000 },
        source: { origin: "gpt", model: "gpt-6.1-sol", assumptions: ["80 m²"] },
      },
    ]);
  });
});
describe("moneyCheck", () => {
  const userBudget = (amount: number): Fact => ({ key: "budget_eur", value: amount, source: { origin: "user", quote: "x" } });

  it("con todo sabido: cobertura, lo que falta, meses que aguanta y si llega al primer ingreso", () => {
    const check = moneyCheck([
      userBudget(40000),
      estimatedRange("startup_cost_eur", 45000, 60000),
      estimatedRange("monthly_fixed_costs_eur", 3000, 5000),
      known("time_to_revenue", "0-3 months"),
    ]);
    assert.equal(check.coverage, "short");
    assert.equal(check.shortfall, 20000);
    assert.equal(check.runwayMonths, 0);
    assert.equal(check.survivesUntilRevenue, false);
    assert.equal(check.estimated, true);
  });

  it("cuando el presupuesto cubre, calcula los meses de margen en el peor caso", () => {
    const check = moneyCheck([
      userBudget(100000),
      estimatedRange("startup_cost_eur", 40000, 60000),
      estimatedRange("monthly_fixed_costs_eur", 3000, 5000),
      known("time_to_revenue", "3-12 months"),
    ]);
    assert.equal(check.coverage, "covers");
    assert.equal(check.shortfall, 0);
    assert.equal(check.runwayMonths, 8);
    assert.equal(check.survivesUntilRevenue, false, "8 meses no llegan a 12");
  });

  it("entre mínimo y máximo es 'tight'", () => {
    assert.equal(moneyCheck([userBudget(50000), estimatedRange("startup_cost_eur", 40000, 60000)]).coverage, "tight");
  });

  it("sin cifra exacta usa el extremo bajo del tramo y lo indica", () => {
    const check = moneyCheck([known("budget_band", "€20k-€50k"), estimatedRange("startup_cost_eur", 10000, 15000)]);
    assert.deepEqual(check.budget, { amount: 20000, basis: "band_floor" });
    assert.equal(check.coverage, "covers");
  });

  it("no usa cifras descartadas por Jev", () => {
    const check = moneyCheck([userBudget(40000), estimatedRange("startup_cost_eur", 100, 500, 0.1)]);
    assert.equal(check.startupCost, null);
    assert.equal(check.coverage, null);
  });

  it("sin datos no inventa nada", () => {
    const check = moneyCheck([]);
    assert.equal(check.budget, null);
    assert.equal(check.coverage, null);
    assert.equal(check.runwayMonths, null);
    assert.equal(check.survivesUntilRevenue, null);
  });
});


describe("tramos de presupuesto sin solape", () => {
  const band = (value: string): Fact => ({
    key: "budget_band",
    value,
    source: { origin: "jev", model: M, confidence: 0.95, from: "user" },
  });

  it("el máximo pertenece a su tramo y no al siguiente", () => {
    assert.equal(budgetMatchesBand(20000, [band("€5k-€20k")]), true);
    assert.equal(budgetMatchesBand(20000, [band("€20k-€50k")]), false);
    assert.equal(budgetMatchesBand(20001, [band("€20k-€50k")]), true);
  });

  it("el primer tramo empieza en 0", () => {
    assert.equal(budgetMatchesBand(0, [band("Under €5k")]), true);
    assert.equal(budgetMatchesBand(5000, [band("Under €5k")]), true);
  });
});