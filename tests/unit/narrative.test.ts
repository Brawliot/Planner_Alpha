import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import {
  buildNarrative,
  extractNumbers,
  mainRisks,
  MAX_SENTENCE_LENGTH,
  narrativeFormat,
  numbersAreAllowed,
  TEMPLATE_REASONS,
  type NarrativeResult,
} from "../../src/lib/report/narrative.ts";
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

function result(areas: Record<string, string>, risks: Record<string, string> = {}, language: NarrativeResult["language"] = "es"): NarrativeResult {
  const wrap = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).map(([k, s]) => [k, { sentence: s }]));
  return { language, areas: wrap(areas), risks: wrap(risks) };
}

describe("extractNumbers", () => {
  it("entiende formatos españoles e ingleses, k y rangos", () => {
    assert.deepEqual(extractNumbers("40.000 €"), [40000]);
    assert.deepEqual(extractNumbers("€40,000"), [40000]);
    assert.deepEqual(extractNumbers("unos 45k"), [45000]);
    assert.deepEqual(extractNumbers("45–60k"), [45, 60000]);
    assert.deepEqual(extractNumbers("1,5 años o 1.5 years"), [1.5, 1.5]);
    assert.deepEqual(extractNumbers("8 meses"), [8]);
    assert.deepEqual(extractNumbers("sin cifras"), []);
  });
});

describe("numbersAreAllowed", () => {
  const allowed = [40000, 45000, 60000, 20000];

  it("acepta los números de los datos y su redondeo", () => {
    assert.equal(numbersAreAllowed("Con 40.000 € no llegas a 45.000–60.000 €", allowed), true);
    assert.equal(numbersAreAllowed("unos 44k", allowed), true);
  });

  it("rechaza un número inventado", () => {
    assert.equal(numbersAreAllowed("un traspaso cuesta 80.000 €", allowed), false);
  });
});

describe("mainRisks", () => {
  const v = (area: string, verdict: AreaVerdict["verdict"]) => ({ area, verdict }) as AreaVerdict;

  it("primero Risk, luego Watch, como mucho 3", () => {
    const risks = mainRisks([v("concept", "watch"), v("money", "risk"), v("market", "strong"), v("founder", "watch"), v("competition", "risk")]);
    assert.deepEqual(risks.map((r) => r.area), ["money", "competition", "concept"]);
  });
});

describe("buildNarrative", () => {
  const verdicts = areaVerdicts(FACTS);

  it("usa la frase de GPT si sus números están en los datos", () => {
    const text = "Con 40.000 € no llegas al coste típico de abrir, unos 45.000–60.000 €.";
    const narrative = buildNarrative(result({ money: text }), IDEA, FACTS, verdicts);
    assert.deepEqual(narrative.areas.money, { text, source: "gpt" });
  });

  it("si GPT inventa una cifra, usa la plantilla en el idioma detectado", () => {
    const narrative = buildNarrative(result({ money: "Un traspaso en Malasaña cuesta 80.000 €." }), IDEA, FACTS, verdicts);
    assert.deepEqual(narrative.areas.money, {
      text: "Tu presupuesto no cubre el coste mínimo estimado para abrir.",
      source: "template",
    });
  });

  it("una frase demasiado larga también va a plantilla", () => {
    const narrative = buildNarrative(result({ money: "a".repeat(MAX_SENTENCE_LENGTH + 1) }), IDEA, FACTS, verdicts);
    assert.equal(narrative.areas.money?.source, "template");
  });

  it("no acepta números de otra área", () => {
    // 45.000 está en Money, no en Concept.
    const narrative = buildNarrative(result({ concept: "Cuesta 45.000 €." }), IDEA, FACTS, verdicts);
    assert.equal(narrative.areas.concept?.source, "template");
  });

  it("las áreas en Needs info van siempre con plantilla", () => {
    const narrative = buildNarrative(result({ competition: "Mucha competencia." }), IDEA, FACTS, verdicts);
    assert.equal(narrative.areas.competition?.text, "Aún no hay información suficiente para valorarlo.");
  });

  it("si GPT falla, todo con plantillas en inglés", () => {
    const narrative = buildNarrative(null, IDEA, FACTS, verdicts);
    assert.equal(narrative.language, "en");
    assert.equal(narrative.areas.money?.text, "Your budget doesn't cover the minimum estimated cost to open.");
    assert.ok(Object.values(narrative.areas).every((s) => s?.source === "template"));
  });

  it("los riesgos principales pasan la misma revisión", () => {
    const narrative = buildNarrative(result({}, { money: "Faltan hasta 99.999 €." }), IDEA, FACTS, verdicts);
    assert.equal(narrative.risks[0].area, "money");
    assert.equal(narrative.risks[0].sentence.source, "template");
  });
});

describe("plantillas y esquema", () => {
  it("hay plantilla para cada motivo que puede dar el veredicto", () => {
    const reasons = [
      "money.short", "money.tight", "money.covers_runway", "money.no_runway", "money.runway_unknown",
      "validation.validated", "validation.partial", "validation.idea_only", "validation.unvalidated_investment",
      "competition.niche", "competition.few", "competition.few_no_differentiator",
      "competition.crowded_differentiated", "competition.crowded_undifferentiated",
      "location.fits", "location.above_average", "location.prime", "location.prime_tight_money",
      "regulation.holds_funds", "regulation.critical", "regulation.regulated",
      "team.demanding", "dependencies.platform", "dependencies.critical",
      "concept.strong", "concept.watch", "concept.risk", "market.strong", "market.watch", "market.risk",
      "founder.strong", "founder.watch", "founder.risk", "needs_info", "jev.unsure",
    ];
    for (const reason of reasons) assert.ok(TEMPLATE_REASONS.includes(reason), reason);
  });

  it("las plantillas no llevan cifras (no pueden contradecir los datos)", () => {
    const narrative = buildNarrative(null, IDEA, FACTS, areaVerdicts(FACTS));
    for (const sentence of Object.values(narrative.areas)) assert.deepEqual(extractNumbers(sentence?.text ?? ""), []);
  });

  it("el esquema pide frase solo para las áreas con veredicto", () => {
    const { schema } = narrativeFormat(areaVerdicts(FACTS));
    const areas = schema.properties.areas as { required: string[] };
    assert.ok(areas.required.includes("money"));
    assert.equal(areas.required.includes("competition"), false);
  });
});