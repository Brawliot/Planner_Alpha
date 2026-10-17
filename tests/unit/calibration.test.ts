import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHOICE_CASES, CHOICE_QUESTIONS, NOUL_CASES } from "../../scripts/calibration/cases.ts";
import { accuracyByBand, agreement, minScoreFor, summarize } from "../../scripts/calibration/metrics.ts";

describe("casos de calibración", () => {
  it("cada respuesta esperada es una opción real de su pregunta", () => {
    for (const item of CHOICE_CASES) {
      assert.ok(
        Object.hasOwn(CHOICE_QUESTIONS[item.question].criteria, item.expected),
        `${item.id}: "${item.expected}" no es una opción de ${item.question}`,
      );
    }
  });

  it("cada caso está en inglés y en español, sin ids repetidos", () => {
    for (const cases of [CHOICE_CASES, NOUL_CASES]) {
      const ids = new Map<string, string[]>();
      for (const item of cases) ids.set(item.id, [...(ids.get(item.id) ?? []), item.lang]);
      for (const [id, langs] of ids) assert.deepEqual(langs.sort(), ["en", "es"], id);
    }
  });

    it("cada pregunta del catálogo tiene al menos 3 casos", () => {
    for (const key of Object.keys(CHOICE_QUESTIONS)) {
      const count = CHOICE_CASES.filter((c) => c.question === key && c.lang === "en").length;
      assert.ok(count >= 3, `${key}: solo ${count} casos`);
    }
  });


  it("hay casos suficientes de cada etiqueta de plausibilidad", () => {
    const count = (label: string) => NOUL_CASES.filter((c) => c.label === label).length;
    assert.ok(count("plausible") >= 10);
    assert.ok(count("implausible") >= 10);
  });
});

describe("minScoreFor", () => {
  const scored = (pairs: Array<[number, boolean]>) => pairs.map(([score, correct]) => ({ score, correct }));

  it("devuelve el umbral más bajo que mantiene el acierto exigido", () => {
    const results = scored([
      [0.99, true], [0.97, true], [0.95, true], [0.9, true], [0.85, true],
      [0.8, false], [0.6, false], [0.5, true], [0.4, false],
    ]);
    const result = minScoreFor(results, 0.95, 3);
    assert.equal(result?.threshold, 0.85);
    assert.equal(result?.support, 5);
    assert.equal(result?.precision, 1);
  });

  it("no corta en mitad de un empate", () => {
    const results = scored([[0.9, true], [0.9, true], [0.9, false], [0.5, false]]);
    // Con 0.9 entran los tres empatados (2/3 de acierto): no llega al 95 %.
    assert.equal(minScoreFor(results, 0.95, 1), null);
  });

  it("exige un mínimo de casos", () => {
    const results = scored([[0.99, true], [0.5, false]]);
    assert.equal(minScoreFor(results, 0.95, 10), null);
  });
});

describe("accuracyByBand", () => {
  it("agrupa por franjas y calcula el acierto de cada una", () => {
    const bands = accuracyByBand(
      [{ score: 0.95, correct: true }, { score: 0.92, correct: false }, { score: 0.3, correct: false }],
      [0, 0.9],
    );
    assert.deepEqual(bands, [
      { band: "0.00–0.90", n: 1, accuracy: 0 },
      { band: "≥ 0.90", n: 2, accuracy: 0.5 },
    ]);
  });
});

describe("agreement y summarize", () => {
  it("cuenta como estable solo si todas las ejecuciones coinciden y son válidas", () => {
    assert.equal(agreement([["a", "a", "a"], ["a", "b", "a"], [null, null, null]]), 1 / 3);
  });

  it("resume mínimo, mediana y máximo", () => {
    assert.deepEqual(summarize([0.9, 0.1, 0.5, 0.3]), { n: 4, min: 0.1, median: 0.4, max: 0.9 });
  });
});