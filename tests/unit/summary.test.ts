import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { narrativeFormat, narrativeParser } from "../../src/lib/report/narrative.ts";
import {
  buildSummary,
  SUMMARY_LIMITS,
  summaryKeys,
  toSegments,
  withSummaryFormat,
  withSummaryParser,
  type SummaryResult,
} from "../../src/lib/report/summary.ts";
import { areaVerdicts, type AreaVerdict } from "../../src/lib/report/verdict.ts";

const M = CALIBRATED_JEV_MODEL;
const IDEA = "Quiero abrir un bar de tapas en Malasaña con 40.000 €";

const budget: Fact = { key: "budget_eur", value: 40000, source: { origin: "user", quote: "40.000 €" } };
const startup: Fact = {
  key: "startup_cost_eur",
  value: { min: 45000, max: 60000 },
  source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: M } },
};
const FACTS = [budget, startup];
const verdicts = areaVerdicts(FACTS);

/** Un texto válido para cada parte que toque. */
function fullResult(overrides: SummaryResult = {}): SummaryResult {
  return {
    lead: "Con 40.000 € no llegas al coste de abrir.",
    strengths: "La idea está clara.",
    work: "Abrir cuesta unos 45.000–60.000 €.",
    unknown: "Falta saber cómo es la competencia.",
    next: "Concreta cuánto puedes invertir.",
    ...overrides,
  };
}

const verdict = (area: string, v: AreaVerdict["verdict"]) => ({ area, verdict: v, reason: "x" }) as unknown as AreaVerdict;

describe("summaryKeys", () => {
  it("entrada y siguiente paso siempre; el resto según los veredictos", () => {
    assert.deepEqual(summaryKeys([verdict("money", "risk")]), ["lead", "work", "next"]);
    assert.deepEqual(summaryKeys([verdict("concept", "strong"), verdict("team", "needs_info")]), [
      "lead",
      "strengths",
      "unknown",
      "next",
    ]);
  });
});

describe("buildSummary", () => {
  it("marca cada cifra: la de la idea, sabida; la estimada, estimada (también en rangos)", () => {
    const summary = buildSummary(fullResult(), IDEA, FACTS, verdicts);
    assert.ok(summary);
    assert.deepEqual(summary.lead, [
      { text: "Con " },
      { text: "40.000 €", certainty: "known" },
      { text: " no llegas al coste de abrir." },
    ]);
    assert.deepEqual(summary.work?.[1], { text: "45.000–60.000 €", certainty: "estimated" });
  });

  it("solo incluye las partes que tocan", () => {
    const summary = buildSummary(fullResult(), IDEA, FACTS, verdicts);
    assert.deepEqual(Object.keys(summary ?? {}).sort(), [...summaryKeys(verdicts)].sort());
  });

  it("si una cifra está en un dato estimado y en uno sabido, se marca estimada", () => {
    const idea = "Un bar con 45.000 €";
    const summary = buildSummary(fullResult({ lead: "Tienes 45.000 €." }), idea, [startup], areaVerdicts([startup]));
    assert.deepEqual(summary?.lead[1], { text: "45.000 €", certainty: "estimated" });
  });

  it("una cifra inventada descarta el resumen entero", () => {
    assert.equal(buildSummary(fullResult({ next: "Busca un socio con 99.000 €." }), IDEA, FACTS, verdicts), null);
  });

  it("una parte demasiado larga o que falta descarta el resumen entero", () => {
    assert.equal(buildSummary(fullResult({ lead: "a".repeat(SUMMARY_LIMITS.lead + 1) }), IDEA, FACTS, verdicts), null);
    const { work: _work, ...withoutWork } = fullResult();
    assert.ok(summaryKeys(verdicts).includes("work"));
    assert.equal(buildSummary(withoutWork, IDEA, FACTS, verdicts), null);
  });

  it("sin respuesta de GPT no hay resumen", () => {
    assert.equal(buildSummary(null, IDEA, FACTS, verdicts), null);
  });
});

describe("toSegments", () => {
  it("texto sin cifras: un solo trozo sin marca", () => {
    assert.deepEqual(
      toSegments("Todo claro.", () => "known"),
      [{ text: "Todo claro." }],
    );
  });
});

describe("esquema y parser", () => {
  it("el esquema añade summary obligatorio con solo las partes que tocan", () => {
    const format = withSummaryFormat(narrativeFormat(verdicts), verdicts);
    assert.ok(format.schema.required.includes("summary"));
    const summary = format.schema.properties.summary as { required: string[] };
    assert.deepEqual(summary.required, summaryKeys(verdicts));
  });

  it("si summary falta o viene mal, queda null y las frases se conservan", () => {
    const parser = withSummaryParser(narrativeParser());
    const parsed = parser.parse({ language: "es", areas: { money: { sentence: "Hola" } }, risks: {} });
    assert.equal(parsed.summary, null);
    assert.equal(parsed.areas.money.sentence, "Hola");
    assert.equal(parser.parse({ language: "es", areas: {}, risks: {}, summary: 3 }).summary, null);
  });

  it("normaliza los espacios del resumen", () => {
    const parser = withSummaryParser(narrativeParser());
    const parsed = parser.parse({ language: "es", areas: {}, risks: {}, summary: { lead: "  Hola\n  mundo " } });
    assert.equal(parsed.summary?.lead, "Hola mundo");
  });
});