import "server-only";
import { callGpt } from "@/lib/gpt";
import { callJev } from "@/lib/jev";
import { buildJevState, type Fact } from "./facts";
import { buildAreas } from "./areas";
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
import { certaintyOf } from "./certainty";
import {
  areaFacts,
  isJevVerdictArea,
  missingCore,
  NOT_ENOUGH_INFORMATION,
  VERDICT_QUESTIONS,
  verdictKey,
  type JevVerdictArea,
} from "./verdict-questions";
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
  const complete = mergeFacts(facts, [...checked, ...fromUser]);
  // Los veredictos de Jev se piden al final: necesitan los datos ya inferidos y validados.
  return mergeFacts(complete, await jevVerdicts(idea, complete));
}

/** Una llamada por área, en paralelo, con solo los datos de esa área (como en la calibración). */
async function jevVerdicts(idea: string, facts: Fact[]): Promise<Fact[]> {
  const areas = buildAreas(facts)
    .map((view) => view.area)
    .filter(isJevVerdictArea)
    .filter((area) => missingCore(facts, area).length === 0);
  return Promise.all(areas.map((area) => jevVerdict(idea, facts, area)));
}

async function jevVerdict(idea: string, facts: Fact[], area: JevVerdictArea): Promise<Fact> {
  const inputs = areaFacts(facts, area);
  const result = await callJev(buildJevState(idea, inputs), { q: VERDICT_QUESTIONS[area] });
  const answer = result.answers.q;
  return {
    key: verdictKey(area),
    value: answer?.choice ?? NOT_ENOUGH_INFORMATION,
    source: {
      origin: "jev",
      model: result.model,
      confidence: answer?.confidence ?? null,
      // Si algún dato del área era estimado, el veredicto también lo es (nunca "sabido").
      from: inputs.every((fact) => certaintyOf(fact) === "known") ? "user" : "inferred",
    },
  };
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
 * Vuelve a pedir a Jev solo los veredictos de estas áreas (tras mejorar un área).
 * Si Jev falla en una, su veredicto queda sin confianza (Needs info): las respuestas no se pierden.
 */
export async function refreshJevVerdicts(
  idea: string,
  facts: Fact[],
  areas: readonly JevVerdictArea[],
): Promise<Fact[]> {
  const present = new Set(buildAreas(facts).map((view) => view.area));
  const targets = areas.filter((area) => present.has(area) && missingCore(facts, area).length === 0);
  const results = await Promise.allSettled(targets.map((area) => jevVerdict(idea, facts, area)));

  const updates = results.map((result, index): Fact => {
    if (result.status === "fulfilled") return result.value;
    console.error("report: no se pudo recalcular un veredicto", result.reason instanceof Error ? result.reason.name : "desconocido");
    return {
      key: verdictKey(targets[index]),
      value: NOT_ENOUGH_INFORMATION,
      source: { origin: "jev", model: "unavailable", confidence: null, from: "user" },
    };
  });
  return mergeFacts(facts, updates);
}


/**
 * Tras un cambio estructural (otro sector, otra oferta...), las estimaciones de GPT y los veredictos
 * de Jev se apoyaban en otro negocio: se descartan y se repite el análisis con lo que dijo el usuario.
 */
export async function reanalyse(idea: string, facts: Fact[]): Promise<Fact[]> {
  const kept = facts.filter((fact) => fact.source.origin !== "gpt" && !fact.key.startsWith("verdict."));
  return analyse(idea, kept);
}