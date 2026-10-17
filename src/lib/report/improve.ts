import { AREAS, type AreaKey } from "./areas.ts";
import { certaintyOf } from "./certainty.ts";
import type { Fact } from "./facts.ts";
import { RENT_LEVELS } from "./figures.ts";
import { answerOptions, CATALOG, type QuestionKey } from "./questions.ts";
import { areaVerdicts, type AreaVerdict } from "./verdict.ts";

/**
 * Preguntas para mejorar cada área del informe ("Improve" en cada fila). Lógica pura:
 * el botón, la respuesta y el recálculo llegan en el paso 10b.
 */

export const MAX_QUESTIONS_PER_AREA = 3;

export type ImproveReason = "unlock_verdict" | "confirm_risk" | "confirm_watch" | "confirm_strong";

export interface ImproveQuestion {
  key: string;
  prompt: string;
  options: string[];
  reason: ImproveReason;
}

export interface AreaImprovement {
  area: AreaKey;
  questions: ImproveQuestion[];
}

/**
 * Cómo se le pregunta al usuario lo que no se pregunta en el flujo base (las "infer" y el alquiler).
 * Las "ask" usan el prompt del catálogo.
 */
const IMPROVE_PROMPTS: Record<string, string> = {
  acquisition_channel: "How will you get your customers?",
  competition: "How much competition is there where you will operate?",
  capital_intensity: "How much capital does your business need?",
  team_requirement: "What team will you need?",
  time_to_revenue: "When do you expect your first revenue?",
  regulatory_load: "How regulated is your business?",
  third_party_dependency: "How much will you depend on other companies?",
  money_handling: "Will you handle your customers' money?",
  rent_level: "How expensive is rent where your premises will be?",
};

const RENT_LEVEL_KEY = "rent_level";

function isCatalogKey(key: string): key is QuestionKey {
  return Object.hasOwn(CATALOG, key);
}

/** Datos que el usuario puede responder: el catálogo y el nivel de alquiler. Las cifras, nunca. */
function isAskable(key: string) {
  return isCatalogKey(key) || key === RENT_LEVEL_KEY;
}

export function improveOptions(key: string): string[] {
  if (key === RENT_LEVEL_KEY) return [...RENT_LEVELS];
  return isCatalogKey(key) ? answerOptions(key) : [];
}

export function improvePrompt(key: string): string {
  if (isCatalogKey(key)) return CATALOG[key].prompt ?? IMPROVE_PROMPTS[key] ?? key;
  return IMPROVE_PROMPTS[key] ?? key;
}

function reasonFor(verdict: AreaVerdict["verdict"]): ImproveReason {
  if (verdict === "risk") return "confirm_risk";
  if (verdict === "watch") return "confirm_watch";
  if (verdict === "strong") return "confirm_strong";
  return "unlock_verdict";
}

function questionsFor(verdict: AreaVerdict, facts: readonly Fact[]): ImproveQuestion[] {
  const inputs: readonly string[] = AREAS[verdict.area].inputs;
  const candidates = inputs.filter((key) => {
    if (!isAskable(key)) return false;
    const fact = facts.find((f) => f.key === key);
    return !fact || certaintyOf(fact) !== "known";
  });

  // En un área sin veredicto, primero los datos imprescindibles que le faltan.
  const ordered = [
    ...candidates.filter((key) => verdict.missing.includes(key)),
    ...candidates.filter((key) => !verdict.missing.includes(key)),
  ];

  const reason = reasonFor(verdict.verdict);
  return ordered.slice(0, MAX_QUESTIONS_PER_AREA).map((key) => ({
    key,
    prompt: improvePrompt(key),
    options: improveOptions(key),
    reason,
  }));
}

/** Preguntas de mejora de cada área, en el orden del informe. Un área sin preguntas no muestra "Improve". */
export function improvementsByArea(facts: readonly Fact[]): AreaImprovement[] {
  return areaVerdicts(facts).map((verdict) => ({ area: verdict.area, questions: questionsFor(verdict, facts) }));
}