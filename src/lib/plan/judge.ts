import type { JevAnswer, JevQuestion } from "../jev.ts";
import { buildJevState, type Fact } from "../report/facts.ts";
import {
  COST_BAND_KEYS,
  EFFORT_BAND_KEYS,
  WAIT_BAND_KEYS,
  costOf,
  effortOf,
  waitOf,
  type CostBand,
  type EffortBand,
  type WaitBand,
} from "./bands.ts";
import { COMPLEXITIES, type Complexity } from "./complexity.ts";
import type { Actor } from "./step.ts";
import type { Range } from "./task.ts";

/**
 * Jev como juez del generador: no escribe nada, elige entre opciones cerradas o puntúa.
 * - Antes de GPT: la complejidad de la tarea para este negocio (cuántas tareas puede generar).
 * - Después: si cada tarea generada es específica y el tramo de horas, euros y espera de cada paso.
 * Instrucciones fijas en inglés; el texto de GPT y del usuario va siempre en el state.
 * Tramo: seguro → ese tramo; dudoso entre vecinos → el tramo y sus vecinos (rango ancho); muy dudoso → se descarta.
 */

/** Calibrado el 2026-10-19 (jev-1.13.0, npm run calibrate:plan): los fallos de complejidad no pasaron de 0,66. */
export const COMPLEXITY_MIN_CONFIDENCE = 0.68;
/** Calibrado el 2026-10-19: lo genérico no pasó de 0,21; 0,30 deja margen. */
export const SPECIFIC_MIN_NOUL = 0.3;
/** PROVISIONALES hasta recalibrar: confianza para el tramo exacto y probabilidad del tramo con sus vecinos. */
export const BAND_EXACT_CONFIDENCE = 0.85;
export const BAND_MIN_MASS = 0.85;

/** Tarea generada tal como la juzga Jev: ids del código, textos de GPT. */
export interface DraftStep {
  id: string;
  text: string;
  /** Quién puede hacerlo (dentro de lo que admite el molde). */
  actors: readonly Actor[];
}
export interface DraftTask {
  id: string;
  title: string;
  outcome: string;
  steps: readonly DraftStep[];
}

/** Cifras ya convertidas a rangos (siempre estimadas). */
export interface StepFigures {
  effort: Range;
  cost: Range;
  /** Solo si lo hace un tercero. */
  wait?: Range;
  /** Algún tramo era dudoso y se amplió a sus vecinos. */
  widened: boolean;
}

export interface TaskReview {
  id: string;
  ok: boolean;
  /** Por qué se descarta: genérica o algún tramo dudoso. */
  reason?: "generic" | "unsure_band";
  steps: Record<string, Partial<Record<Actor, StepFigures>>>;
}

type Answers = Record<string, JevAnswer | null>;

/** El informe separado por origen, más lo que se juzga como dato aparte. */
export function judgeState(idea: string, facts: readonly Fact[], target: Record<string, unknown>) {
  return { ...buildJevState(idea, facts), target };
}

// ---- Antes de GPT: complejidad

const COMPLEXITY_CRITERIA: Record<Complexity, string> = {
  low: "A few simple steps the founder can do alone",
  medium: "Several steps, or one external party involved",
  high: "Many steps, several external parties, permits or technical work",
};

export const COMPLEXITY_QUESTION = {
  type: "choice",
  instructions: "How much work does the task in target involve for this specific business?",
  criteria: COMPLEXITY_CRITERIA,
} as const satisfies JevQuestion;

/** null si Jev no está seguro: complexity.ts la trata como baja. */
export function readComplexity(answer: JevAnswer | null): Complexity | null {
  if (answer?.type !== "choice" || answer.confidence < COMPLEXITY_MIN_CONFIDENCE) return null;
  return (COMPLEXITIES as readonly string[]).includes(answer.choice) ? (answer.choice as Complexity) : null;
}

// ---- Después de GPT: especificidad y tramos

const EFFORT_CRITERIA: Record<EffortBand, string> = {
  under_1h: "Less than 1 hour",
  "1_4h": "Between 1 and 4 hours",
  "4_8h": "Between 4 and 8 hours (about one working day)",
  "1_3d": "Between 1 and 3 working days (8 to 24 hours)",
  "1_2w": "Between 1 and 2 working weeks (40 to 80 hours)",
};
const COST_CRITERIA: Record<CostBand, string> = {
  free: "No cost",
  under_100: "Up to 100 euros",
  "100_500": "Between 100 and 500 euros",
  "500_2000": "Between 500 and 2,000 euros",
  "2000_10000": "Between 2,000 and 10,000 euros",
};
const WAIT_CRITERIA: Record<WaitBand, string> = {
  under_1w: "Up to 1 week",
  "1_4w": "Between 1 and 4 weeks",
  "1_3m": "Between 1 and 3 months",
  "3_6m": "Between 3 and 6 months",
};

const WHO: Record<Actor, string> = {
  user: "the user does it themself",
  ai: "an AI drafts it inside the app",
  third_party: "a third party does it",
};
const EFFORT_MEANING: Record<Actor, string> = {
  user: "how many hours of the user's work does it take?",
  ai: "how many hours does the user need to review and finish the draft?",
  third_party: "how many hours does the user spend requesting it and following up?",
};

const key = (kind: string, task: string, step?: string, actor?: Actor) =>
  [kind, task, step, actor].filter((part) => part !== undefined).join(".");

/** Todas las preguntas de una llamada para las tareas generadas (en target.tasks). */
export function reviewQuestions(tasks: readonly DraftTask[]): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {};
  for (const task of tasks) {
    questions[key("specific", task.id)] = {
      type: "noul",
      instructions:
        `Is task ${task.id} in target.tasks specific to this business, using details from the state, ` +
        "rather than generic advice that would fit any business?",
    };
    for (const step of task.steps) {
      for (const actor of step.actors) {
        const where = `Task ${task.id}, step ${step.id} in target.tasks, if ${WHO[actor]}`;
        questions[key("effort", task.id, step.id, actor)] = {
          type: "choice",
          instructions: `${where}: ${EFFORT_MEANING[actor]}`,
          criteria: EFFORT_CRITERIA,
        };
        questions[key("cost", task.id, step.id, actor)] = {
          type: "choice",
          instructions:
            `${where}: how much does it cost in euros? Count only fees and professional services; ` +
            "exclude investment (premises, works, equipment, stock) and recurring monthly costs.",
          criteria: COST_CRITERIA,
        };
        if (actor === "third_party") {
          questions[key("wait", task.id, step.id, actor)] = {
            type: "choice",
            instructions: `${where}: how long does the user wait for the result?`,
            criteria: WAIT_CRITERIA,
          };
        }
      }
    }
  }
  return questions;
}

/** Una tarea pasa si es específica y Jev está seguro de todos sus tramos; si no, se descarta entera. */
export function readReview(tasks: readonly DraftTask[], answers: Answers): TaskReview[] {
  return tasks.map((task) => {
    const steps: TaskReview["steps"] = {};
    let unsure = false;
    for (const step of task.steps) {
      steps[step.id] = {};
      for (const actor of step.actors) {
        const effort = readBand(answers[key("effort", task.id, step.id, actor)] ?? null, EFFORT_BAND_KEYS, effortOf);
        const cost = readBand(answers[key("cost", task.id, step.id, actor)] ?? null, COST_BAND_KEYS, costOf);
        const wait =
          actor === "third_party" ? readBand(answers[key("wait", task.id, step.id, actor)] ?? null, WAIT_BAND_KEYS, waitOf) : undefined;
        if (effort === null || cost === null || wait === null) {
          unsure = true;
          continue;
        }
        steps[step.id][actor] = {
          effort: effort.range,
          cost: cost.range,
          ...(wait ? { wait: wait.range } : {}),
          widened: effort.widened || cost.widened || Boolean(wait?.widened),
        };
      }
    }
    const specific = readNoul(answers[key("specific", task.id)] ?? null, SPECIFIC_MIN_NOUL);
    if (!specific) return { id: task.id, ok: false, reason: "generic", steps };
    if (unsure) return { id: task.id, ok: false, reason: "unsure_band", steps };
    return { id: task.id, ok: true, steps };
  });
}

// ---- Lectura estricta

/** Probabilidad del tramo elegido más la de sus vecinos (null si la opción no es un tramo). */
export function nearMass(answer: JevAnswer | null, keys: readonly string[]): number | null {
  if (answer?.type !== "choice") return null;
  const index = keys.indexOf(answer.choice);
  if (index < 0) return null;
  return keys.slice(Math.max(0, index - 1), index + 2).reduce((sum, k) => sum + (answer.probabilities[k] ?? 0), 0);
}

/** Seguro: su tramo. Dudoso entre vecinos: el tramo y sus vecinos juntos. Muy dudoso o inválido: null. */
function readBand<K extends string>(
  answer: JevAnswer | null,
  keys: readonly K[],
  rangeOf: (band: K) => Range,
): { range: Range; widened: boolean } | null {
  const mass = nearMass(answer, keys);
  if (answer?.type !== "choice" || mass === null) return null;
  const index = keys.indexOf(answer.choice as K);
  if (answer.confidence >= BAND_EXACT_CONFIDENCE) return { range: rangeOf(keys[index]), widened: false };
  if (mass < BAND_MIN_MASS) return null;
  const near = keys.slice(Math.max(0, index - 1), index + 2).map(rangeOf);
  return {
    range: { min: Math.min(...near.map((r) => r.min)), max: Math.max(...near.map((r) => r.max)) },
    widened: true,
  };
}

function readNoul(answer: JevAnswer | null, min: number) {
  return answer?.type === "noul" && answer.noul >= min;
}