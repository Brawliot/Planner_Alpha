import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL, NOT_SPECIFIED } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import {
  CANNOT_INFER,
  INFERENCE_INSTRUCTIONS,
  inferenceFormat,
  inferenceInput,
  inferenceParser,
  inferredFacts,
  keysToInfer,
} from "../../src/lib/report/inference.ts";

function jevFact(key: string, value: string, confidence: number): Fact {
  return { key, value, source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence, from: "user" } };
}

describe("keysToInfer", () => {
  it("solo las 'infer' que no se saben", () => {
    const facts = [
      jevFact("competition", NOT_SPECIFIED, 0.99),
      jevFact("regulatory_load", "Light", 0.95),
      jevFact("budget_band", NOT_SPECIFIED, 0.99),
    ];
    const keys = keysToInfer(facts);
    assert.ok(keys.includes("competition"));
    assert.equal(keys.includes("regulatory_load"), false, "ya se sabe");
    assert.equal(keys.includes("budget_band"), false, "es 'ask': se pregunta, no se infiere");
  });

  it("no vuelve a inferir lo que GPT ya infirió", () => {
    const gpt: Fact = { key: "competition", value: "Crowded market", source: { origin: "gpt", model: "g", assumptions: [] } };
    assert.equal(keysToInfer([gpt]).includes("competition"), false);
  });
});

describe("inferenceFormat", () => {
  const format = inferenceFormat(["competition"]);
  const item = (format.schema.properties as Record<string, { properties: { value: { enum: string[] } }; additionalProperties: boolean }>).competition;

  it("cumple las reglas de Structured Outputs estricto", () => {
    assert.equal(format.schema.type, "object");
    assert.equal(format.schema.additionalProperties, false);
    assert.deepEqual(format.schema.required, ["competition"]);
    assert.equal(item.additionalProperties, false);
  });

  it('solo ofrece opciones del catálogo y "Cannot infer", nunca "Not specified"', () => {
    assert.ok(item.properties.value.enum.includes("Crowded market"));
    assert.ok(item.properties.value.enum.includes(CANNOT_INFER));
    assert.equal(item.properties.value.enum.includes(NOT_SPECIFIED), false);
  });
});

describe("inferenceParser", () => {
  const parser = inferenceParser(["competition"]);

  it("acepta una opción válida y recorta los supuestos", () => {
    const result = parser.parse({
      competition: { value: "Crowded market", assumptions: ["  uno  ", "", "dos", "tres", "cuatro", "x".repeat(500)] },
    });
    assert.deepEqual(result.competition.assumptions, ["uno", "dos", "tres"]);
  });

  it("rechaza una opción inventada o una clave que falta", () => {
    assert.equal(parser.safeParse({ competition: { value: "Mucha", assumptions: [] } }).success, false);
    assert.equal(parser.safeParse({}).success, false);
  });
});

describe("inferenceInput", () => {
  it("pasa el texto del usuario y solo los datos sabidos", () => {
    const facts = [jevFact("sector", "Hospitality/Food service", 0.95), jevFact("budget_band", "€20k-€50k", 0.5)];
    const input = inferenceInput("Un bar en Malasaña", facts, ["competition"]);
    assert.equal(input.user_text, "Un bar en Malasaña");
    assert.deepEqual(input.known_facts, [{ key: "sector", value: "Hospitality/Food service" }]);
    assert.equal(input.to_infer[0].question, "What is the competition like?");
    assert.equal(Object.hasOwn(input.to_infer[0].options, NOT_SPECIFIED), false);
  });

  it("las instrucciones son fijas: nunca llevan texto del usuario", () => {
    assert.equal(INFERENCE_INSTRUCTIONS.includes("Malasaña"), false);
  });
});

describe("inferredFacts", () => {
  it('crea datos con origen GPT y omite "Cannot infer"', () => {
    const facts = inferredFacts(
      {
        competition: { value: "Crowded market", assumptions: ["muchos bares"] },
        regulatory_load: { value: CANNOT_INFER, assumptions: [] },
      },
      ["competition", "regulatory_load"],
      "gpt-6.1-sol",
    );
    assert.deepEqual(facts, [
      {
        key: "competition",
        value: "Crowded market",
        source: { origin: "gpt", model: "gpt-6.1-sol", assumptions: ["muchos bares"] },
      },
    ]);
  });
});