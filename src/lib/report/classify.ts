import "server-only";
import { callJev, type JevChoiceAnswer } from "@/lib/jev";
import { classifyQuestions, combineClassification, phraseFacts } from "./deduce";
import { buildJevState, type Fact } from "./facts";
import { extractQuantities, phraseState } from "./phrases";
import { mergeFacts } from "./questions";

/**
 * Clasifica la idea con Jev en una llamada: "dicho", "probable" y, si hay cantidades, cuál es
 * el presupuesto, el plazo o la experiencia. Lo que no se sepa acaba como pregunta o para GPT.
 */
export async function classifyIdea(idea: string): Promise<Fact[]> {
  const quantities = extractQuantities(idea);
  // Sin cantidades, el state es exactamente el calibrado para las preguntas fijas.
  const state = quantities.length > 0 ? phraseState(idea, quantities) : buildJevState(idea, []);
  const result = await callJev(state, classifyQuestions(quantities));
  const answers = result.answers as Record<string, JevChoiceAnswer | null>;
  // Lo calculado de una cantidad literal gana a la clasificación por tramos.
  return mergeFacts(combineClassification(answers, result.model), phraseFacts(answers, quantities, idea, result.model));
}