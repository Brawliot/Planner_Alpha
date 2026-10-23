import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CANT_TELL, DONT_KNOW, NOT_DECIDED } from "../../src/lib/report/certainty.ts";
import { RENT_LEVELS } from "../../src/lib/report/figures.ts";
import { hasLabel, valueLabel } from "../../src/lib/report/labels.ts";
import { answerOptions, QUESTION_KEYS } from "../../src/lib/report/questions.ts";

describe("etiquetas en español", () => {
  it("toda opción que ve la usuaria tiene etiqueta", () => {
    const options = [
      ...QUESTION_KEYS.flatMap((key) => answerOptions(key)),
      ...RENT_LEVELS,
      NOT_DECIDED,
      DONT_KNOW,
      CANT_TELL,
    ];
    for (const option of options) assert.ok(hasLabel(option), `sin etiqueta: ${option}`);
  });

  it("la etiqueta no es el valor en inglés (salvo palabras iguales en los dos idiomas)", () => {
    assert.equal(valueLabel("Idea only"), "Solo la idea");
    assert.equal(valueLabel("3-12 months"), "3-12 meses");
    assert.equal(valueLabel("High (inventory, equipment, premises or R&D)"), "Alta (existencias, equipos, local o I+D)");
  });

  it("un valor desconocido se muestra tal cual, sin romper la pantalla", () => {
    assert.equal(valueLabel("algo nuevo"), "algo nuevo");
  });
});
