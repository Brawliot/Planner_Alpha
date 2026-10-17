import type { AreaKey } from "./areas.ts";
import type { Fact } from "./facts.ts";
import { RENT_LEVELS } from "./figures.ts";
import { answerOptions, CATALOG, type QuestionKey } from "./questions.ts";
import { areaVerdicts, type AreaVerdict } from "./verdict.ts";

/**
 * Preguntas para mejorar cada área del informe ("Improve" en cada fila). Lógica pura:
 * el botón, la respuesta y el recálculo llegan en el paso 10b.
 */

export const MAX_QUESTIONS_PER_AREA = 3;

/** unlock_verdict: falta para dar color al área. complete_area: no cambia el color, concreta el plan. */
export type ImproveReason = "unlock_verdict" | "complete_area";

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

/**
 * Hechos del mercado: los investiga el programa y, si no se saben, son tareas del plan.
 * Nunca se le preguntan al usuario en Improve (sí se pueden corregir en Edit).
 */
const RESEARCH_KEYS = new Set<string>([
  "competition",
  "capital_intensity",
  "team_requirement",
  "time_to_revenue",
  "regulatory_load",
  "third_party_dependency",
  RENT_LEVEL_KEY,
]);

/** Datos que el usuario puede responder: los suyos del catálogo. Ni las cifras ni la investigación. */
function isAskable(key: string) {
  return isCatalogKey(key) && !RESEARCH_KEYS.has(key);
}

export function improveOptions(key: string): string[] {
  if (key === RENT_LEVEL_KEY) return [...RENT_LEVELS];
  return isCatalogKey(key) ? answerOptions(key) : [];
}

export function improvePrompt(key: string): string {
  if (isCatalogKey(key)) return CATALOG[key].prompt ?? IMPROVE_PROMPTS[key] ?? key;
  return IMPROVE_PROMPTS[key] ?? key;
}

/** Lo que el usuario ya respondió no se vuelve a preguntar, aunque fuera "I don't know": ya es un hecho. */
function answeredByUser(facts: readonly Fact[], key: string) {
  return facts.some((f) => f.key === key && f.source.origin === "user");
}

/**
 * Solo lo que no se sabe: primero lo imprescindible para dar color, luego lo que falta por concretar.
 * Lo estimado (deducido por Jev o validado como plausible) no se pregunta: se corrige en Edit.
 */
function questionsFor(verdict: AreaVerdict, facts: readonly Fact[]): ImproveQuestion[] {
  const askable = (key: string) => isAskable(key) && !answeredByUser(facts, key);
  const candidates = [
    ...verdict.missing.filter(askable).map((key) => ({ key, reason: "unlock_verdict" as const })),
    ...verdict.gaps.filter(askable).map((key) => ({ key, reason: "complete_area" as const })),
  ];
  return candidates.slice(0, MAX_QUESTIONS_PER_AREA).map(({ key, reason }) => ({
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


export type ImproveAnswers = { ok: true; facts: Fact[] } | { ok: false };

/** Valida en servidor las respuestas a las preguntas del área: todas, y solo con opciones de la lista. */
export function parseImproveAnswers(questions: readonly ImproveQuestion[], get: (name: string) => unknown): ImproveAnswers {
  const facts: Fact[] = [];
  for (const question of questions) {
    const value = get(question.key);
    if (typeof value !== "string" || !question.options.includes(value)) return { ok: false };
    // En una respuesta cerrada, la cita es la opción que eligió el usuario.
    facts.push({ key: question.key, value, source: { origin: "user", quote: value } });
  }
  return { ok: true, facts };
}
