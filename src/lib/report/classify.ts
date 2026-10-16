import "server-only";
import { callJev } from "@/lib/jev";
import { NOT_SPECIFIED } from "./certainty";
import { buildJevState, type Fact } from "./facts";
import { BASE_QUESTIONS, BASE_QUESTION_KEYS } from "./questions";

/** Clasifica la idea con Jev. Lo que no se sepa con seguridad acabará como pregunta. */
export async function classifyIdea(idea: string): Promise<Fact[]> {
  const result = await callJev(buildJevState(idea, []), BASE_QUESTIONS);
  return BASE_QUESTION_KEYS.map((key): Fact => {
    const answer = result.answers[key];
    return {
      key,
      value: answer?.choice ?? NOT_SPECIFIED,
      source: { origin: "jev", model: result.model, confidence: answer?.confidence ?? null, from: "user" },
    };
  });
}