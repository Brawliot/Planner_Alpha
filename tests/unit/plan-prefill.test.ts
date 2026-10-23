import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planConfigSchema } from "../../src/lib/plan/config.ts";
import { addMonths, launchTargetOf, nextMonday, prefillConfig } from "../../src/lib/plan/prefill.ts";
import { CALIBRATED_JEV_MODEL, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
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

// 2026-10-18 es domingo.
const TODAY = "2026-10-18";

describe("fechas", () => {
  it("próximo lunes, y si hoy es lunes el siguiente", () => {
    assert.equal(nextMonday("2026-10-18"), "2026-10-19");
    assert.equal(nextMonday("2026-10-19"), "2026-10-26");
    assert.equal(nextMonday("2026-10-21"), "2026-10-26");
  });

  it("suma meses", () => {
    assert.equal(addMonths("2026-10-19", 6), "2027-04-19");
  });
});

describe("prefillConfig", () => {
  it("sin datos: valores por defecto, inicio el próximo lunes y nada marcado", () => {
    const { config, prefilled } = prefillConfig([], TODAY);
    assert.equal(config.startDate, "2026-10-19");
    assert.deepEqual(prefilled, []);
    assert.ok(planConfigSchema.safeParse(config).success);
  });

  it("rellena desde el informe y marca el origen y la certeza", () => {
    const { config, prefilled } = prefillConfig(
      [
        known("time_commitment", "20-40 h/week"),
        known("launch_timeline", "3-6 months"),
        estimated("founder_profile", "Technical"),
        known("validation_stage", "Idea only"),
      ],
      TODAY,
    );
    assert.deepEqual(config.weeklyHours, { min: 20, max: 40 });
    assert.equal(config.targetDate, undefined);
    assert.deepEqual(config.skills, ["programming"]);
    assert.equal(config.validationLevel, 3);
    assert.deepEqual(prefilled, [
      { field: "weeklyHours", from: "time_commitment", certainty: "known" },
      { field: "skills", from: "founder_profile", certainty: "estimated" },
      { field: "validationLevel", from: "validation_stage", certainty: "known" },
    ]);
    assert.ok(planConfigSchema.safeParse(config).success);
  });

  it("lo no sabido o sin correspondencia clara no rellena nada", () => {
    const { config, prefilled } = prefillConfig(
      [
        known("validation_stage", NOT_SPECIFIED),
        known("founder_profile", "Several areas"),
        known("launch_timeline", "Over 18 months"),
      ],
      TODAY,
    );
    assert.deepEqual(prefilled, []);
    assert.deepEqual(config.skills, []);
    assert.equal(config.targetDate, undefined);
    assert.equal(config.validationLevel, 2);
  });
});

describe("launchTargetOf", () => {
  it("el plazo del informe es un rango de meses, nunca una fecha", () => {
    assert.deepEqual(launchTargetOf([known("launch_timeline", "3-6 months")]), { min: 3, max: 6 });
    assert.deepEqual(launchTargetOf([known("launch_timeline", "Under 3 months")]), { min: 0, max: 3 });
  });

  it("sin plazo, sin dato o más allá de 18 meses: null", () => {
    assert.equal(launchTargetOf([]), null);
    assert.equal(launchTargetOf([known("launch_timeline", "Over 18 months")]), null);
    assert.equal(launchTargetOf([known("launch_timeline", NOT_SPECIFIED)]), null);
  });
});
