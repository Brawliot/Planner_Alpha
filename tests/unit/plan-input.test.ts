import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planFingerprint, planInput } from "../../src/lib/plan/input.ts";
import { CALIBRATED_JEV_MODEL, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";

const known = (key: string, value: string, confidence = 0.95): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence, from: "user" },
});

const FACTS: Fact[] = [
  known("sector", "Hospitality/Food service"),
  known("offering_type", "Physical venue"),
  known("competition", "Saturated market"),
];

const fp = (facts: Fact[]) => planFingerprint(facts, areaVerdicts(facts));

describe("planFingerprint", () => {
  it("no cambia con el orden de los datos ni con la confianza si la certeza es la misma", () => {
    assert.equal(fp(FACTS), fp([...FACTS].reverse()));
    assert.equal(fp(FACTS), fp([known("sector", "Hospitality/Food service", 0.99), ...FACTS.slice(1)]));
  });

  it("cambia si cambia un valor", () => {
    assert.notEqual(fp(FACTS), fp([...FACTS.slice(0, 2), known("competition", "Few competitors")]));
  });

  it("un dato no sabido cuenta como ausente", () => {
    assert.equal(fp(FACTS), fp([...FACTS, known("validation_stage", NOT_SPECIFIED)]));
  });
});

describe("planInput", () => {
  it("lee el informe en directo: veredictos calculados, idioma de la narrativa o inglés", () => {
    const base = { id: "r1", idea: "Cafetería", facts: FACTS, narrative: null };
    const input = planInput(base);
    assert.equal(input.reportId, "r1");
    assert.equal(input.language, "en");
    assert.deepEqual(input.verdicts, areaVerdicts(FACTS));
    assert.equal(input.fingerprint, fp(FACTS));

    const es = planInput({ ...base, narrative: { language: "es", areas: {}, risks: [], fingerprints: {} } });
    assert.equal(es.language, "es");
  });
});