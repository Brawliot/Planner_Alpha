import { z } from "zod";

/**
 * "Lo que nos has contado": respuestas del usuario a las preguntas previas de "Generar".
 * Son dichas por el usuario (se pueden citar), se reutilizan en cada "Generar" y no se vuelven
 * a preguntar, ni siquiera las de "Aún no lo sé" (answer null), que se completan desde la lista.
 */

export const MAX_QUESTIONS = 3;
export const MAX_QUESTION_LENGTH = 200;
export const MAX_OPTION_LENGTH = 80;
export const MAX_ANSWER_LENGTH = 200;

export const planAnswerSchema = z.object({
  id: z.string().min(1),
  /** Molde en cuyo "Generar" se preguntó. */
  mold: z.string().min(1),
  question: z.string().min(1).max(MAX_QUESTION_LENGTH),
  /** null = "Aún no lo sé". */
  answer: z.string().min(1).max(MAX_ANSWER_LENGTH).nullable(),
});
export type PlanAnswer = z.infer<typeof planAnswerSchema>;

/** Pregunta propuesta por GPT y ya revisada por el código (aún sin respuesta). */
export interface DraftQuestion {
  id: string;
  mold: string;
  text: string;
  options: string[];
}

export type Reply = { kind: "option"; value: string } | { kind: "other"; text: string } | { kind: "unknown" };

/** Id por molde (o departamento): cada uno solo pregunta una vez, así que nunca se repite. */
export const answerId = (mold: string, index: number) => `${mold}#${index + 1}`;

/** Respuestas guardables a partir de lo que elige el usuario. null si alguna no encaja con su pregunta. */
export function answersFromReplies(
  questions: readonly DraftQuestion[],
  replies: Readonly<Record<string, Reply | undefined>>,
): PlanAnswer[] | null {
  const result: PlanAnswer[] = [];
  for (const question of questions) {
    const reply = replies[question.id];
    if (!reply) return null;
    let answer: string | null;
    if (reply.kind === "unknown") answer = null;
    else if (reply.kind === "option") {
      if (!question.options.includes(reply.value)) return null;
      answer = reply.value;
    } else {
      answer = reply.text.trim();
      if (answer.length === 0 || answer.length > MAX_ANSWER_LENGTH) return null;
    }
    result.push({ id: question.id, mold: question.mold, question: question.text, answer });
  }
  return result;
}