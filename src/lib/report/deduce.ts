import type { JevChoiceAnswer } from "../jev.ts";
import { FIGURE_KEYS } from "./areas.ts";
import { CALIBRATED_JEV_MODEL, certaintyOf, KNOWN_MIN_CONFIDENCE, NOT_SPECIFIED } from "./certainty.ts";
import { userFact, type Fact } from "./facts.ts";
import { NONE, phraseBand, phraseQuestion, type PhraseDimension, type Quantity } from "./phrases.ts";
import {
  CATALOG_JEV_QUESTIONS,
  LIKELY_JEV_QUESTIONS,
  LIKELY_KEYS,
  QUESTION_KEYS,
  type QuestionKey,
} from "./questions.ts";
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

// ---- Cantidades: "tengo 20.000 €", "abriré en 4 meses", "llevo 10 años de camarero".

export const PHRASE_PREFIX = "phrase_";

const PHRASE_KEYS: Record<PhraseDimension, QuestionKey> = {
  budget: "budget_band",
  launch: "launch_timeline",
  experience: "founder_experience",
};
const DIMENSIONS = Object.keys(PHRASE_KEYS) as PhraseDimension[];

/** Preguntas de la primera llamada: las fijas más una por cada dimensión con cantidades compatibles. */
export function classifyQuestions(quantities: readonly Quantity[]) {
  const phrases = DIMENSIONS.flatMap((dimension) => {
    const question = phraseQuestion(dimension, quantities);
    return question ? [[`${PHRASE_PREFIX}${dimension}`, question] as const] : [];
  });
  return { ...CLASSIFY_QUESTIONS, ...Object.fromEntries(phrases) };
}

/**
 * La cantidad que Jev elige con seguridad pasa a dato del usuario: el tramo lo calcula el código
 * y la cita es el fragmento literal (userFact la comprueba). Con un rango solo se guarda el tramo.
 */
export function phraseFacts(answers: Answers, quantities: readonly Quantity[], idea: string, model: string): Fact[] {
  if (model !== CALIBRATED_JEV_MODEL) return [];
  return DIMENSIONS.flatMap((dimension) => {
    const answer = answers[`${PHRASE_PREFIX}${dimension}`];
    if (!answer || answer.choice === NONE || answer.confidence < KNOWN_MIN_CONFIDENCE) return [];
    const quantity = quantities.find((q) => q.id === answer.choice);
    const band = quantity && phraseBand(dimension, quantity);
    if (!quantity || !band) return [];

    const facts: Array<Fact | null> = [userFact(PHRASE_KEYS[dimension], band, quantity.text, [idea])];
    if (dimension === "budget" && quantity.min === quantity.max) {
      facts.push(userFact(FIGURE_KEYS.budget, quantity.min, quantity.text, [idea]));
    }
    return facts.filter((fact): fact is Fact => fact !== null);
  });
}