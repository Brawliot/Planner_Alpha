import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractQuantities, NONE, parseNumber, phraseBand, phraseQuestion } from "../../src/lib/report/phrases.ts";

const only = (text: string) => {
  const list = extractQuantities(text);
  assert.equal(list.length, 1, `${text}: ${JSON.stringify(list)}`);
  return list[0];
};

describe("parseNumber", () => {
  it("separa miles de decimales", () => {
    assert.equal(parseNumber("20.000"), 20000);
    assert.equal(parseNumber("20,000"), 20000);
    assert.equal(parseNumber("1,5"), 1.5);
    assert.equal(parseNumber("2.5"), 2.5);
  });
});

describe("extractQuantities", () => {
  it("dinero en sus formas habituales", () => {
    assert.deepEqual(
      ["20.000 €", "€20,000", "15k", "50 mil euros", "1,5 millones de euros"].map((t) => [only(t).unit, only(t).min]),
      [["eur", 20000], ["eur", 20000], ["eur", 15000], ["eur", 50000], ["eur", 1500000]],
    );
  });

  it("plazos y rangos", () => {
    const range = only("de 3 a 5 años");
    assert.deepEqual([range.text, range.unit, range.min, range.max], ["3 a 5 años", "years", 3, 5]);
    assert.deepEqual([only("6-8 months").min, only("6-8 months").max], [6, 8]);
    assert.equal(only("in 8 weeks").unit, "months");
  });

  it("ignora números sin unidad y guarda la frase de contexto", () => {
    const list = extractQuantities("Un local de 80 m² con 40 mesas. Tengo 20.000 € para empezar; abriré en 4 meses");
    assert.deepEqual(list.map((q) => q.text), ["20.000 €", "4 meses"]);
    assert.equal(list[0].clause, "Tengo 20.000 € para empezar");
    assert.deepEqual(list.map((q) => q.id), ["p1", "p2"]);
  });
});

describe("phraseQuestion", () => {
  it("solo ofrece cantidades compatibles, más 'None'", () => {
    const quantities = extractQuantities("Tengo 20.000 € y abriré en 4 meses");
    assert.deepEqual(Object.keys(phraseQuestion("budget", quantities)?.criteria ?? {}), ["p1", NONE]);
    assert.deepEqual(Object.keys(phraseQuestion("launch", quantities)?.criteria ?? {}), ["p2", NONE]);
  });

  it("sin candidatas no hay pregunta y el texto nunca va en los criterios", () => {
    assert.equal(phraseQuestion("budget", extractQuantities("abriré en 4 meses")), null);
    const q = phraseQuestion("budget", extractQuantities("Tengo 20.000 €"));
    assert.ok(!JSON.stringify(q).includes("20.000"));
  });
});

describe("phraseBand", () => {
  it("convierte a tramos con el valor prudente", () => {
    assert.equal(phraseBand("budget", only("20.000 €")), "€5k-€20k");
    assert.equal(phraseBand("budget", only("entre 20 y 30 mil euros")), "€5k-€20k");
    assert.equal(phraseBand("launch", only("3 meses")), "3-6 months");
    assert.equal(phraseBand("launch", only("6-8 meses")), "6-12 months");
    assert.equal(phraseBand("launch", only("2 años")), "Over 18 months");
    assert.equal(phraseBand("experience", only("de 3 a 5 años")), "2-5 years");
    assert.equal(phraseBand("experience", only("18 meses")), "Under 2 years");
  });
});