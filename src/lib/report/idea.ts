export const IDEA_MAX_LENGTH = 2000;

export type IdeaResult = { ok: true; idea: string } | { ok: false; error: string };

/** Validación en servidor; el maxLength del formulario es solo comodidad. */
export function parseIdea(value: unknown): IdeaResult {
  if (typeof value !== "string") return { ok: false, error: "Escribe tu idea." };
  const idea = value.trim();
  if (!idea) return { ok: false, error: "Escribe tu idea." };
  if (idea.length > IDEA_MAX_LENGTH) {
    return { ok: false, error: `La idea puede tener como máximo ${IDEA_MAX_LENGTH} caracteres.` };
  }
  return { ok: true, idea };
}