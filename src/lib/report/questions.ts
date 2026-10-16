import type { JevQuestion } from "../jev.ts";
import { certaintyOf, NOT_SPECIFIED } from "./certainty.ts";
import type { Fact } from "./facts.ts";

type ChoiceQuestion = Extract<JevQuestion, { type: "choice" }>;

const ONLY_IF_SUPPORTED =
  'Choose an option only if user_text supports it; otherwise choose "Not specified".';

/**
 * Preguntas base de clasificación. Los umbrales de certainty.ts se calibraron con este texto
 * exacto: si cambias instrucciones u opciones, vuelve a ejecutar npm run calibrate:jev.
 */
export const BASE_QUESTIONS = {
  sector: {
    type: "choice",
    instructions: "What is the business sector?",
    criteria: {
      "Technology/SaaS": "Software, apps, digital platforms or technology products",
      "Hospitality/Food service": "Restaurants, bars, cafes, hotels or catering",
      "Retail/Commerce": "Physical or online stores selling products to consumers",
      Manufacturing: "Industrial manufacturing or production of goods",
      "Professional Services": "Specialized services such as lawyers, architects or accounting firms",
      "Finance/Banking/Insurance": "Financial services, banking, investment or insurance",
      "Health/Medicine": "Clinics, healthcare services, pharmacy or medical wellness",
      "Education/Training": "Academies, courses, schools or training",
      "Logistics/Transport": "Transport of goods or people, warehousing or delivery",
      "Construction/Real Estate": "Building work, renovations, development, or buying, selling and renting property",
      "Marketing/Advertising/Agencies": "Marketing, advertising, communication or design agencies",
      "Media/Content/Entertainment": "Media outlets, content creation, leisure or events",
      "Agriculture/Livestock": "Crop growing, livestock or primary agri-food production",
      "Energy/Utilities": "Generation or supply of energy, water or other utilities",
      "Consulting/Advisory": "Strategic, business or technical advice to other companies",
      Other: "Does not fit any of the categories above",
    },
  },
  geographic_scope: {
    type: "choice",
    instructions: `What is the geographic scope of the business? ${ONLY_IF_SUPPORTED}`,
    criteria: {
      "Hyper-local": "A very specific neighborhood or area within a city",
      Local: "A city or municipality",
      Regional: "A province or autonomous community",
      National: "A whole country",
      International: "Several countries",
      Online: "Purely digital business with no physical geographic scope",
      "Not specified": "user_text does not say",
    },
  },
  validation_stage: {
    type: "choice",
    instructions: `How validated is the business? ${ONLY_IF_SUPPORTED}`,
    criteria: {
      "Idea only": "Concept without external validation",
      "Problem validated": "Confirmed that the problem exists",
      Prototype: "Working prototype or MVP developed",
      "MVP with customers": "Minimum viable product with early customers",
      "Generating revenue": "Currently making money from customers",
      Growing: "Revenue and user base are growing",
      "Not specified": "user_text does not say",
    },
  },
} satisfies Record<string, ChoiceQuestion>;

export type BaseQuestionKey = keyof typeof BASE_QUESTIONS;
export const BASE_QUESTION_KEYS = Object.keys(BASE_QUESTIONS) as BaseQuestionKey[];

/** Cómo se le pregunta al usuario lo que Jev no ha podido saber con seguridad. */
export const USER_PROMPTS: Record<BaseQuestionKey, string> = {
  sector: "What sector is your business in?",
  geographic_scope: "Where will your business operate?",
  validation_stage: "How far along is your idea?",
};

/** Opciones para el usuario: todas menos "Not specified" (si responde, ya se sabe). */
export function answerOptions(key: BaseQuestionKey) {
  return Object.keys(BASE_QUESTIONS[key].criteria).filter((option) => option !== NOT_SPECIFIED);
}

/** Preguntas base cuyo dato no es SABIDO: se le preguntan al usuario. */
export function pendingQuestions(facts: readonly Fact[]): BaseQuestionKey[] {
  return BASE_QUESTION_KEYS.filter((key) => {
    const fact = facts.find((f) => f.key === key);
    return !fact || certaintyOf(fact) !== "known";
  });
}

export function nextStatus(facts: readonly Fact[]) {
  return pendingQuestions(facts).length > 0 ? "questions" : "review";
}

export type AnswersResult = { ok: true; facts: Fact[] } | { ok: false; error: string };

/** Valida en servidor las respuestas a las preguntas pendientes y las convierte en datos del usuario. */
export function parseAnswers(
  pending: readonly BaseQuestionKey[],
  get: (name: string) => unknown,
): AnswersResult {
  const facts: Fact[] = [];
  for (const key of pending) {
    const value = get(key);
    if (typeof value !== "string" || !answerOptions(key).includes(value)) {
      return { ok: false, error: "Answer all the questions." };
    }
    // En una respuesta cerrada, la cita es la opción que eligió el usuario.
    facts.push({ key, value, source: { origin: "user", quote: value } });
  }
  return { ok: true, facts };
}

/** Sustituye los datos de las mismas claves y conserva el resto. */
export function mergeFacts(current: readonly Fact[], updates: readonly Fact[]): Fact[] {
  const keys = new Set(updates.map((f) => f.key));
  return [...current.filter((f) => !keys.has(f.key)), ...updates];
}