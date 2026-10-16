import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALIBRATED_JEV_MODEL,
  certaintyOf,
  NOT_SPECIFIED,
} from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";

const M = CALIBRATED_JEV_MODEL;

function jev(confidence: number | null, from: "user" | "inferred" = "user", model = M, value: unknown = "Hospitality"): Fact {
  return { key: "sector", value, source: { origin: "jev", model, confidence, from } };
}

function gpt(noul: number | null, model = M): Fact {
  return {
    key: "monthly_rent_eur",
    value: { min: 3000, max: 6000 },
    source: {
      origin: "gpt",
      model: "gpt",
      assumptions: ["local de 80 m²"],
      plausibility: noul === null ? null : { noul, model },
    },
  };
}

describe("certaintyOf: datos del usuario", () => {
  it("con cita es known", () => {
    assert.equal(certaintyOf({ key: "budget_eur", value: 40000, source: { origin: "user", quote: "40.000 €" } }), "known");
  });
});

describe("certaintyOf: Jev", () => {
  it("interpretando al usuario con confianza alta es known", () => {
    assert.equal(certaintyOf(jev(0.85)), "known");
    assert.equal(certaintyOf(jev(0.99)), "known");
  });

  it("con confianza baja es unknown", () => {
    assert.equal(certaintyOf(jev(0.84)), "unknown");
    assert.equal(certaintyOf(jev(null)), "unknown");
  });

  it("interpretando supuestos nunca es known, como mucho estimated", () => {
    assert.equal(certaintyOf(jev(0.99, "inferred")), "estimated");
    assert.equal(certaintyOf(jev(0.5, "inferred")), "unknown");
  });

  it("con un modelo no calibrado es unknown aunque la confianza sea alta", () => {
    assert.equal(certaintyOf(jev(0.99, "user", "jev-1.14.0")), "unknown");
  });

  it('"Not specified" es unknown aunque Jev esté seguro', () => {
    assert.equal(certaintyOf(jev(0.99, "user", M, NOT_SPECIFIED)), "unknown");
  });
});

describe("certaintyOf: inferencias de GPT", () => {
  it("plausibles son estimated", () => {
    assert.equal(certaintyOf(gpt(0.7)), "estimated");
    assert.equal(certaintyOf(gpt(0.9)), "estimated");
  });

  it("absurdas se descartan", () => {
    assert.equal(certaintyOf(gpt(0.5)), "discarded");
    assert.equal(certaintyOf(gpt(0.02)), "discarded");
  });

  it("dudosas son unknown", () => {
    assert.equal(certaintyOf(gpt(0.51)), "unknown");
    assert.equal(certaintyOf(gpt(0.69)), "unknown");
  });

  it("sin validar por Jev son unknown", () => {
    assert.equal(certaintyOf(gpt(null)), "unknown");
    const { plausibility: _omit, ...withoutCheck } = gpt(0.9).source as Extract<Fact["source"], { origin: "gpt" }>;
    assert.equal(certaintyOf({ key: "x", value: 1, source: withoutCheck }), "unknown");
  });

  it("validadas con un modelo no calibrado son unknown", () => {
    assert.equal(certaintyOf(gpt(0.9, "jev-1.14.0")), "unknown");
  });
});