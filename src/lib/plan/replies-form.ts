import type { DraftQuestion, Reply } from "./answers.ts";

/** Valores especiales del formulario de preguntas previas (además de las opciones de GPT). */
export const UNKNOWN_REPLY = "__unknown";
export const OTHER_REPLY = "__other";

/** Lee las respuestas del formulario. null si falta alguna o no encaja con su pregunta. */
export function parseReplies(
  questions: readonly DraftQuestion[],
  get: (name: string) => unknown,
): Record<string, Reply> | null {
  if (questions.length === 0) return null;
  const replies: Record<string, Reply> = {};
  for (const q of questions) {
    const value = get(`q:${q.id}`);
    if (value === UNKNOWN_REPLY) {
      replies[q.id] = { kind: "unknown" };
    } else if (value === OTHER_REPLY) {
      const text = get(`other:${q.id}`);
      if (typeof text !== "string" || text.trim().length === 0) return null;
      replies[q.id] = { kind: "other", text: text.trim() };
    } else if (typeof value === "string" && q.options.includes(value)) {
      replies[q.id] = { kind: "option", value };
    } else {
      return null;
    }
  }
  return replies;
}