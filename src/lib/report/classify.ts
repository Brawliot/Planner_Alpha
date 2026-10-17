import "server-only";
import { callJev } from "@/lib/jev";
import { CLASSIFY_QUESTIONS, combineClassification } from "./deduce";
import { buildJevState, type Fact } from "./facts";

/** Clasifica la idea con Jev en una llamada ("dicho" + "probable"). Lo no sabido acaba como pregunta o para GPT. */
export async function classifyIdea(idea: string): Promise<Fact[]> {
  const result = await callJev(buildJevState(idea, []), CLASSIFY_QUESTIONS);
  return combineClassification(result.answers, result.model);
}