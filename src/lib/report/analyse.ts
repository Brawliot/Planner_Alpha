import "server-only";
import { callGpt } from "@/lib/gpt";
import { callJev } from "@/lib/jev";
import { buildJevState, type Fact } from "./facts";
import { areaVerdicts } from "./verdict";
import {
  areaFingerprints,
  buildNarrative,
  mergeNarrative,
  NARRATIVE_INSTRUCTIONS,
  narrativeFormat,
  narrativeInput,
  narrativeParser,
  staleAreas,
  type NarrativeResult,
  type StoredNarrative,
} from "./narrative";
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
import {
  FIGURES_INSTRUCTIONS,
  figureFacts,
  figuresFormat,
  figuresInput,
  figuresParser,
  rangesToEstimate,
  shouldEstimateRentLevel,
  shouldExtractBudget,
} from "./figures";
/**
 * Completa el análisis:
 * - GPT infiere las preguntas "infer" que faltan y estima las cifras (dos llamadas en paralelo);
 * - Jev puntúa la plausibilidad de cada inferencia y cada rango.
 * certaintyOf decide después si cada dato es estimado, no sabido o descartado.
 */
export async function analyse(idea: string, facts: Fact[]): Promise<Fact[]> {
  const [inferred, figures] = await Promise.all([inferDimensions(idea, facts), estimateFigures(idea, facts)]);

  // El presupuesto extraído es del usuario (con cita): no pasa por la plausibilidad.
  const fromGpt = [...inferred, ...figures].filter((fact) => fact.source.origin === "gpt");
  const fromUser = figures.filter((fact) => fact.source.origin === "user");
  const checked = await Promise.all(fromGpt.map((fact) => withPlausibility(idea, fact)));
  // Los veredictos se calculan en código al leer: no hay que pedir nada más.
  return mergeFacts(facts, [...checked, ...fromUser]);
}

async function inferDimensions(idea: string, facts: Fact[]): Promise<Fact[]> {
  const keys = keysToInfer(facts);
  if (keys.length === 0) return [];
  const result = await callGpt({
    task: "infer",
    instructions: INFERENCE_INSTRUCTIONS,
    input: inferenceInput(idea, facts, keys),
    format: inferenceFormat(keys),
    parse: inferenceParser(keys),
    effort: "low",
  });
  return inferredFacts(result.data, keys, result.model);
}

async function estimateFigures(idea: string, facts: Fact[]): Promise<Fact[]> {
  const ranges = rangesToEstimate(facts);
  const rentLevel = shouldEstimateRentLevel(facts);
  if (ranges.length === 0 && !rentLevel && !shouldExtractBudget(facts)) return [];
  const result = await callGpt({
    task: "infer",
    instructions: FIGURES_INSTRUCTIONS,
    input: figuresInput(idea, facts, ranges),
    format: figuresFormat(ranges, rentLevel),
    parse: figuresParser(ranges, rentLevel),
    effort: "low",
  });
  return figureFacts(result.data, ranges, result.model, idea, facts);
}

/** Cada dato se valida por separado, con el mismo formato de state con el que se calibró. */
async function withPlausibility(idea: string, fact: Fact): Promise<Fact> {
  if (fact.source.origin !== "gpt") return fact;
  const check = await callJev(buildJevState(idea, [fact]), { q: PLAUSIBILITY_QUESTION });
  const noul = check.answers.q?.noul;
  return {
    ...fact,
    source: { ...fact.source, plausibility: noul === undefined ? null : { noul, model: check.model } },
  };
}


/**
 * Frases del informe. Nunca lanza error: si GPT falla, se usan plantillas.
 * Con una narrativa anterior, solo cambian las frases de las áreas cuyos datos cambiaron;
 * si no cambió ninguna, ni siquiera se llama a GPT.
 */
export async function writeNarrative(
  idea: string,
  facts: Fact[],
  previous: StoredNarrative | null = null,
): Promise<StoredNarrative> {
  const verdicts = areaVerdicts(facts);
  const fingerprints = areaFingerprints(facts, verdicts);
  const stale = staleAreas(previous, fingerprints);
  if (previous && stale.length === 0) return previous;

  let result: NarrativeResult | null = null;
  if (verdicts.some((v) => v.verdict !== "needs_info")) {
    try {
      const response = await callGpt({
        task: "write",
        instructions: NARRATIVE_INSTRUCTIONS,
        input: narrativeInput(idea, facts, verdicts),
        format: narrativeFormat(verdicts),
        parse: narrativeParser(),
        effort: "low",
      });
      result = response.data;
    } catch (err) {
      // Las frases no son críticas: el informe sale con plantillas.
      console.error("report: no se pudieron redactar las frases", err instanceof Error ? err.name : "desconocido");
    }
  }

  return mergeNarrative(buildNarrative(result, idea, facts, verdicts), previous, stale, fingerprints);
}

/**
 * Tras un cambio estructural (otro sector, otra oferta...), las estimaciones de GPT y los veredictos
 * de Jev se apoyaban en otro negocio: se descartan y se repite el análisis con lo que dijo el usuario.
 */
export async function reanalyse(idea: string, facts: Fact[]): Promise<Fact[]> {
    // Las deducciones de Jev ("likely") se apoyaban en el negocio anterior: también se descartan.
  const kept = facts.filter(
    (fact) =>
      fact.source.origin !== "gpt" &&
      !(fact.source.origin === "jev" && fact.source.from === "likely") &&
      !fact.key.startsWith("verdict."),
  );
  return analyse(idea, kept);
}