import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AREAS, AREA_KEYS, buildAreas } from "../../src/lib/report/areas.ts";
import { CALIBRATED_JEV_MODEL, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { CATALOG, type QuestionKey } from "../../src/lib/report/questions.ts";

const M = CALIBRATED_JEV_MODEL;

function known(key: string, value: string): Fact {
  return { key, value, source: { origin: "jev", model: M, confidence: 0.95, from: "user" } };
}

function estimated(key: string, value: string, noul = 0.8): Fact {
  return { key, value, source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul, model: M } } };
}

const BASE: Fact[] = [
  known("sector", "Hospitality/Food service"),
  known("offering_type", "Software"),
  known("validation_stage", "Idea only"),
];

const areasOf = (facts: Fact[]) => buildAreas(facts).map((a) => a.area);

describe("definición de áreas", () => {
  it("cada opción usada en una condición existe en el catálogo", () => {
    for (const area of AREA_KEYS) {
      for (const condition of (AREAS[area] as { appliesWhen?: Array<{ key: QuestionKey; anyOf: string[] }> }).appliesWhen ?? []) {
        for (const option of condition.anyOf) {
          assert.ok(Object.hasOwn(CATALOG[condition.key].jev.criteria, option), `${area}: "${option}" no existe en ${condition.key}`);
        }
      }
    }
  });
});

describe("buildAreas: qué áreas aparecen", () => {
  it("las 6 fijas aparecen siempre, en orden", () => {
    assert.deepEqual(areasOf([]), ["concept", "validation", "market", "competition", "money", "founder"]);
  });

  it("Location solo si es un local físico", () => {
    assert.equal(areasOf(BASE).includes("location"), false);
    assert.ok(areasOf([known("offering_type", "Physical venue")]).includes("location"));
  });

  it("Regulation con carga moderada o mayor, o si custodia dinero ajeno", () => {
    assert.ok(areasOf([estimated("regulatory_load", "Heavy (health, finance, food)")]).includes("regulation"));
    assert.ok(areasOf([known("money_handling", "Holds or intermediates funds")]).includes("regulation"));
    assert.equal(areasOf([known("regulatory_load", "Light")]).includes("regulation"), false);
    assert.equal(areasOf([known("money_handling", "Collects through a payment provider")]).includes("regulation"), false);
  });

  it("Team y Dependencies solo en los casos que importan", () => {
    assert.ok(areasOf([known("team_requirement", "Specialized profiles required")]).includes("team"));
    assert.equal(areasOf([known("team_requirement", "Feasible solo")]).includes("team"), false);
    assert.ok(areasOf([known("third_party_dependency", "Depends on a platform")]).includes("dependencies"));
    assert.equal(areasOf([known("third_party_dependency", "Autonomous")]).includes("dependencies"), false);
  });

  it("un dato no sabido o descartado no activa un área", () => {
    assert.equal(areasOf([known("offering_type", NOT_SPECIFIED)]).includes("location"), false);
    assert.equal(areasOf([estimated("regulatory_load", "Heavy (health, finance, food)", 0.1)]).includes("regulation"), false);
    assert.equal(areasOf([estimated("regulatory_load", "Heavy (health, finance, food)", 0.6)]).includes("regulation"), false);
  });
});

describe("buildAreas: contenido de cada área", () => {
  it("separa datos utilizables y lo que falta", () => {
    const concept = buildAreas(BASE).find((a) => a.area === "concept");
    assert.deepEqual(concept?.inputs.map((i) => i.key), ["sector", "offering_type"]);
    assert.deepEqual(concept?.missing, ["revenue_model", "differentiator"]);
    assert.equal(concept?.estimated, false);
  });

  it("marca el área como estimada si alguno de sus datos lo es", () => {
    const competition = buildAreas([estimated("competition", "Crowded market")]).find((a) => a.area === "competition");
    assert.equal(competition?.estimated, true);
    assert.equal(competition?.inputs[0].certainty, "estimated");
  });

  it("lo descartado no se usa y cuenta como falta", () => {
    const competition = buildAreas([estimated("competition", "Crowded market", 0.1)]).find((a) => a.area === "competition");
    assert.deepEqual(competition?.inputs, []);
    assert.deepEqual(competition?.missing, ["competition", "differentiator"]);
  });

  it("las cifras de Money aparecen como pendientes hasta el paso 8b", () => {
    const money = buildAreas([]).find((a) => a.area === "money");
    assert.ok(money?.missing.includes("startup_cost_eur"));
    assert.ok(money?.missing.includes("monthly_fixed_costs_eur"));
  });
});