import "server-only";
import { callGpt } from "@/lib/gpt";
import { callJev } from "@/lib/jev";
import { buildJevState, type Fact } from "./facts";
import { mergeFacts } from "./questions";
import { PLAUSIBILITY_QUESTION } from "./plausibility";
import {
  INFERENCE_INSTRUCTIONS,
  inferenceFormat,
  inferenceInput,
  inferenceParser,
  inferredFacts,
  keysToInfer,
} from "./inference";

/**
 * Completa el análisis: GPT infiere las preguntas "infer" que faltan y Jev puntúa la plausibilidad
 * de cada inferencia. certaintyOf decide después si cada una es estimada, no sabida o descartada.
 */
export async function analyse(idea: string, facts: Fact[]): Promise<Fact[]> {
  const keys = keysToInfer(facts);
  if (keys.length === 0) return facts;

  const result = await callGpt({
    task: "infer",
    instructions: INFERENCE_INSTRUCTIONS,
    input: inferenceInput(idea, facts, keys),
    format: inferenceFormat(keys),
    parse: inferenceParser(keys),
    effort: "low",
  });

  // Cada inferencia se valida por separado, con el mismo formato de state con el que se calibró.
  const checked = await Promise.all(
    inferredFacts(result.data, keys, result.model).map(async (fact): Promise<Fact> => {
      const check = await callJev(buildJevState(idea, [fact]), { q: PLAUSIBILITY_QUESTION });
      const noul = check.answers.q?.noul;
      if (fact.source.origin !== "gpt") return fact;
      return {
        ...fact,
        source: { ...fact.source, plausibility: noul === undefined ? null : { noul, model: check.model } },
      };
    }),
  );

  return mergeFacts(facts, checked);
}