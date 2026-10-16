import "server-only";
import { callJev } from "@/lib/jev";
import { NOT_SPECIFIED } from "./certainty";
import { buildJevState, type Fact } from "./facts";
import { CATALOG_JEV_QUESTIONS, QUESTION_KEYS } from "./questions";

/** Clasifica la idea con Jev (todo el catálogo en una llamada). Lo que no se sepa acabará como pregunta o para GPT. */
export async function classifyIdea(idea: string): Promise<Fact[]> {
  const result = await callJev(buildJevState(idea, []), CATALOG_JEV_QUESTIONS);
  return QUESTION_KEYS.map((key): Fact => {
    const answer = result.answers[key];
    return {
      key,
      value: answer?.choice ?? NOT_SPECIFIED,
      source: { origin: "jev", model: result.model, confidence: answer?.confidence ?? null, from: "user" },
    };
  });
}