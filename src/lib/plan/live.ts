import "server-only";
import { callGpt, type GptRequest } from "../gpt.ts";
import { callJev, type JevQuestions, type JevState } from "../jev.ts";
import type { GenerateDeps } from "./generate.ts";

/**
 * GPT y Jev reales para "Generar" (tareas, departamentos y borradores). La lógica recibe estas
 * funciones como parámetro; los tests le pasan respuestas falsas.
 */
export const liveDeps: GenerateDeps = {
  gpt: <T>(request: GptRequest<T>) => callGpt(request),
  jev: (state: JevState, questions: JevQuestions) => callJev(state, questions),
};