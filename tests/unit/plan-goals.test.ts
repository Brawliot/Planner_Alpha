import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOUNDER_REASON, RISK_GOALS, launchGoal, lineGoal } from "../../src/lib/plan/goals.ts";
import { BUSINESS_STATES } from "../../src/lib/plan/states.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { TEMPLATE_REASONS } from "../../src/lib/report/narrative.ts";

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

/** Motivos que no son rojos. Si se añade un verde nuevo, apúntalo aquí. */
const NOT_RED = new Set([
  "needs_info",
  "jev.unsure",
  "concept.strong",
  "market.strong",
  "founder.strong",
  "money.covers_runway",
  "money.runway_unknown",
  "validation.validated",
  "competition.niche",
  "competition.few",
  "location.fits",
  "regulation.moderate",
]);

const risk = (reason: string) => ({ kind: "risk" as const, area: "concept" as const, reason });

describe("objetivos de las líneas", () => {
  it("todo motivo rojo del informe tiene objetivo, y la tabla no tiene motivos inventados", () => {
    for (const reason of TEMPLATE_REASONS.filter((r) => !NOT_RED.has(r))) {
      if (reason === FOUNDER_REASON) continue;
      assert.ok(lineGoal(risk(reason), [])?.length, `sin objetivo: ${reason}`);
    }
    for (const reason of Object.keys(RISK_GOALS)) assert.ok(TEMPLATE_REASONS.includes(reason), `motivo inventado: ${reason}`);
  });

  it("todos los objetivos son estados del vocabulario", () => {
    for (const goal of Object.values(RISK_GOALS)) for (const state of goal) assert.ok(BUSINESS_STATES.includes(state));
  });

  it("competencia saturada: analizar la competencia y diferenciarse", () => {
    assert.deepEqual(lineGoal(risk("competition.crowded"), []), ["competitors_mapped", "differentiator_defined"]);
  });

  it("'Tú' en rojo: el objetivo depende de la causa y suma todas", () => {
    const facts = [
      known("founder_experience", "None"),
      known("time_commitment", "Under 10 h/week"),
      known("founder_profile", "Technical"),
      known("team_requirement", "Large team"),
    ];
    assert.deepEqual(lineGoal(risk(FOUNDER_REASON), facts), ["founder_gap_covered", "time_secured", "roles_defined"]);

    const onlyTime = [known("founder_experience", "Over 5 years"), known("time_commitment", "10-20 h/week")];
    assert.deepEqual(lineGoal(risk(FOUNDER_REASON), onlyTime), ["time_secured"]);
  });

  it("gris, por concretar y estimado: saber cada dato", () => {
    const keys = ["monthly_fixed_costs_eur", "competition"];
    for (const kind of ["needs_info", "gaps", "estimated"] as const) {
      assert.deepEqual(lineGoal({ kind, area: "money", keys }, []), ["fact:monthly_fixed_costs_eur", "fact:competition"]);
    }
  });

  it("un motivo desconocido no tiene objetivo; la base sale de la meta de lanzamiento", () => {
    assert.equal(lineGoal(risk("concept.invented"), []), null);
    assert.deepEqual(lineGoal({ kind: "base" }, []), []);
  });
});

describe("meta de lanzamiento", () => {
  it("cafetería, nivel 1: clientes, alta, local y licencias; sin producto digital", () => {
    const facts = [
      known("offering_type", "Physical venue"),
      known("regulatory_load", "Heavy (health, finance, food)"),
      known("acquisition_channel", "Foot traffic or location"),
    ];
    assert.deepEqual(launchGoal(facts, 1), [
      "first_customers",
      "legal_entity_ready",
      "premises_ready",
      "licenses_granted",
      "suppliers_chosen",
    ]);
  });

  it("SaaS, nivel 1: clientes, alta, producto y web; sin local", () => {
    const facts = [known("offering_type", "Software"), known("acquisition_channel", "Online self-service")];
    assert.deepEqual(launchGoal(facts, 1), ["first_customers", "legal_entity_ready", "mvp_ready", "website_ready"]);
  });

  it("los niveles suben lo que se pide, sin repetir la web", () => {
    const facts = [known("acquisition_channel", "Online self-service")];
    assert.deepEqual(launchGoal(facts, 2), [
      "first_customers",
      "legal_entity_ready",
      "website_ready",
      "bank_account_ready",
      "brand_ready",
    ]);
    assert.equal(launchGoal(facts, 3).filter((s) => s === "website_ready").length, 1);
    assert.ok(launchGoal([], 3).includes("website_ready"));
  });

  it("solo cuentan los datos sabidos: un local estimado no se pide aún", () => {
    assert.ok(!launchGoal([estimated("offering_type", "Physical venue")], 1).includes("premises_ready"));
  });
});