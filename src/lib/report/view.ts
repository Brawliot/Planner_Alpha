import { AREAS, type AreaKey } from "./areas.ts";
import { certaintyOf } from "./certainty.ts";
import type { Fact } from "./facts.ts";
import { mainRisks, templateFor, type Language, type StoredNarrative } from "./narrative.ts";
import { areaVerdicts, type AreaVerdict, type Verdict } from "./verdict.ts";
import { improvementsByArea } from "./improve.ts";

/**
 * Vista del informe: lo único que llega al navegador. Textos y veredictos ya decididos;
 * nunca los datos internos (confianzas, orígenes, modelos).
 */

export const MAX_ASSUMPTIONS_SHOWN = 3;

export type FooterState = "all_good" | "risks" | "missing_data";

export interface AreaCard {
  area: AreaKey;
  verdict: Verdict;
  sentence: string;
  estimated: boolean;
  assumptions: string[];
  /** Preguntas para mejorar el área (vacío: sin botón "Mejorar"). */
  questions: Array<{ key: string; prompt: string; options: string[] }>;
}

export interface ReportView {
  language: Language;
  idea: string;
  areas: AreaCard[];
  risks: Array<{ area: AreaKey; verdict: Verdict; sentence: string }>;
  footer: FooterState;
}

/** Faltan datos si algún área no tiene veredicto; si no, hay riesgos si alguna es Risk. */
export function footerState(verdicts: readonly AreaVerdict[]): FooterState {
  if (verdicts.some((v) => v.verdict === "needs_info")) return "missing_data";
  if (verdicts.some((v) => v.verdict === "risk")) return "risks";
  return "all_good";
}

/** Supuestos de los datos estimados del área, sin repetidos y como mucho 3. */
function assumptionsFor(facts: readonly Fact[], area: AreaKey): string[] {
  const inputs: readonly string[] = AREAS[area].inputs;
  const all = facts.flatMap((fact) =>
    inputs.includes(fact.key) && fact.source.origin === "gpt" && certaintyOf(fact) === "estimated"
      ? fact.source.assumptions
      : [],
  );
  return [...new Set(all)].slice(0, MAX_ASSUMPTIONS_SHOWN);
}

export function reportView(idea: string, facts: readonly Fact[], narrative: StoredNarrative | null): ReportView {
  const verdicts = areaVerdicts(facts);
  const language: Language = narrative?.language ?? "en";
  // Si una frase falta (informe antiguo o área nueva), la plantilla de su motivo.
  const sentenceOf = (v: AreaVerdict) => narrative?.areas[v.area]?.text ?? templateFor(v.reason, language);
  const improvements = improvementsByArea(facts);
  const questionsOf = (area: AreaKey) =>
    (improvements.find((i) => i.area === area)?.questions ?? []).map(({ key, prompt, options }) => ({ key, prompt, options }));
  return {
    language,
    idea,
    areas: verdicts.map((v) => ({
      area: v.area,
      verdict: v.verdict,
      sentence: sentenceOf(v),
      estimated: v.estimated,
      assumptions: v.estimated ? assumptionsFor(facts, v.area) : [],
      questions: questionsOf(v.area),
    })),
    risks: mainRisks(verdicts).map((v) => ({
      area: v.area,
      verdict: v.verdict,
      sentence: narrative?.risks.find((r) => r.area === v.area)?.sentence.text ?? sentenceOf(v),
    })),
    footer: footerState(verdicts),
  };
}