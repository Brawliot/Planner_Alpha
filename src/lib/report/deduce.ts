import type { JevChoiceAnswer } from "../jev.ts";
import { certaintyOf, NOT_SPECIFIED } from "./certainty.ts";
import type { Fact } from "./facts.ts";
import { CATALOG_JEV_QUESTIONS, LIKELY_JEV_QUESTIONS, LIKELY_KEYS, QUESTION_KEYS } from "./questions.ts";

/**
 * Primera llamada a Jev: "dicho" (¿lo dice el texto?) y "probable" (¿qué es lo más probable
 * para este negocio?) van juntas. Cada dimensión se queda con la mejor respuesta que sea fiable.
 */
export const LIKELY_PREFIX = "likely_";

export const CLASSIFY_QUESTIONS = {
  ...CATALOG_JEV_QUESTIONS,
  ...Object.fromEntries(LIKELY_KEYS.map((key) => [`${LIKELY_PREFIX}${key}`, LIKELY_JEV_QUESTIONS[key]])),
};

type Answers = Record<string, JevChoiceAnswer | null | undefined>;

/** Sabido si lo dice el texto; si no, estimado si se deduce con seguridad; si no, no sabido. */
export function combineClassification(answers: Answers, model: string): Fact[] {
  return QUESTION_KEYS.map((key): Fact => {
    const stated = answers[key];
    const statedFact: Fact = {
      key,
      value: stated?.choice ?? NOT_SPECIFIED,
      source: { origin: "jev", model, confidence: stated?.confidence ?? null, from: "user" },
    };
    if (certaintyOf(statedFact) === "known" || !LIKELY_KEYS.includes(key)) return statedFact;

    const likely = answers[`${LIKELY_PREFIX}${key}`];
    if (!likely) return statedFact;
    const likelyFact: Fact = {
      key,
      value: likely.choice,
      source: { origin: "jev", model, confidence: likely.confidence, from: "likely" },
    };
    // "Can't tell" o confianza baja: queda como no sabido y se pregunta (o lo intenta GPT).
    return certaintyOf(likelyFact) === "estimated" ? likelyFact : statedFact;
  });
}