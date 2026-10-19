import type { JevAnswer, JevQuestion } from "../jev.ts";
import { buildJevState, type Fact } from "../report/facts.ts";

/**
 * Jev como juez del generador: puntúa si cada tarea generada es específica de este negocio.
 * Instrucciones fijas y en inglés; el texto de GPT y del usuario va siempre en el state.
 *
 * Calibración del 2026-10-19 (jev-1.13.0, npm run calibrate:plan, dos ejecuciones de ~580 llamadas):
 * - Especificidad: separa sin errores (genéricas <= 0,21; específicas desde 0,19-0,22).
 * - Descartado, tramos de horas, euros y espera: en horas solo acierta el tramo exacto el 34 %; contando
 *   tramo y vecinos, solo el 72 % de las respuestas alcanza un umbral fiable, así que una tarea con unos
 *   8 tramos se descartaría 9 de cada 10 veces. Las cifras salen del paso del molde que concreta cada paso.
 * - Descartado, complejidad: 65-70 % de acierto y fallos con confianza 0,67. GPT decide cuántas tareas
 *   genera, con el tope MAX_GENERATED_TASKS (concretion.ts).
 */

/** Las genéricas no pasaron de 0,21: 0,30 deja margen. */
export const SPECIFIC_MIN_NOUL = 0.3;

/** Tarea generada tal como la juzga Jev: ids del código, textos de GPT. */
export interface DraftTask {
  id: string;
  title: string;
  outcome: string;
  steps: readonly { id: string; text: string }[];
}

/** El informe separado por origen, más lo que se juzga como dato aparte. */
export function judgeState(idea: string, facts: readonly Fact[], target: Record<string, unknown>) {
  return { ...buildJevState(idea, facts), target };
}

const key = (taskId: string) => `specific.${taskId}`;

/** Una pregunta por tarea generada (en target.tasks). */
export function specificityQuestions(tasks: readonly DraftTask[]): Record<string, JevQuestion> {
  return Object.fromEntries(
    tasks.map((task) => [
      key(task.id),
      {
        type: "noul",
        instructions:
          `Is task ${task.id} in target.tasks specific to this business, using details from the state, ` +
          "rather than generic advice that would fit any business?",
      } satisfies JevQuestion,
    ]),
  );
}

/** Específica solo con respuesta válida y por encima del umbral; si no, se trata como genérica. */
export function isSpecific(taskId: string, answers: Record<string, JevAnswer | null>) {
  const answer = answers[key(taskId)] ?? null;
  return answer?.type === "noul" && answer.noul >= SPECIFIC_MIN_NOUL;
}