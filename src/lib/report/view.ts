import { AREAS, type AreaKey } from "./areas.ts";
import { certaintyOf } from "./certainty.ts";
import type { Fact } from "./facts.ts";
import { mainRisks, templateFor, type Language, type StoredNarrative } from "./narrative.ts";
import { areaVerdicts, type AreaVerdict, type Verdict } from "./verdict.ts";
import { improvementsByArea } from "./improve.ts";
import { findContradictions, type Contradiction } from "./contradictions.ts";
import { usable } from "./areas.ts";
import { reportTexts } from "./i18n.ts";

/**
 * Vista del informe: lo único que llega al navegador. Textos y veredictos ya decididos;
 * nunca los datos internos (confianzas, orígenes, modelos).
 */

export const MAX_ASSUMPTIONS_SHOWN = 3;

export type FooterState = "all_good" | "risks" | "missing_data" | "contradictions";

export interface AreaCard {
  area: AreaKey;
  verdict: Verdict;
  sentence: string;
  estimated: boolean;
  assumptions: string[];
  /** Preguntas para mejorar el área (vacío: sin botón "Mejorar"). */
  questions: Array<{ key: string; prompt: string; options: string[] }>;
  /** Datos en que se apoya el área, ya formateados: valor y si es tuyo o una estimación. */
  data: Array<{ key: string; label: string; value: string; estimated: boolean }>;
}

export interface ReportView {
  language: Language;
  idea: string;
  areas: AreaCard[];
  risks: Array<{ area: AreaKey; verdict: Verdict; sentence: string }>;
  footer: FooterState;
  /** Área que abre el botón principal ("Revisar riesgos" o "Completar datos"). */
  focusArea: AreaKey | null;
  contradictions: Contradiction[];
  /** Aprobado: solo lectura hasta que se reabra. */
  approved: boolean;
}

const MONTHLY_KEYS = ["monthly_fixed_costs_eur", "monthly_rent_eur"];

/** Valor legible en el idioma del informe: euros con su formato y rangos con "/mes" si son mensuales. */
function formatValue(key: string, value: unknown, language: Language) {
  const eur = new Intl.NumberFormat(language === "es" ? "es-ES" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const suffix = MONTHLY_KEYS.includes(key) ? reportTexts(language).perMonth : "";
  if (typeof value === "number") return eur.format(value) + suffix;
  if (typeof value === "object" && value !== null && "min" in value && "max" in value) {
    const { min, max } = value as { min: number; max: number };
    return `${eur.format(min)}–${eur.format(max)}${suffix}`;
  }
  return String(value);
}

/** Solo lo utilizable (sabido o estimado): lo no sabido ya lo dicen el veredicto y "Mejorar". */
function dataFor(facts: readonly Fact[], area: AreaKey, language: Language) {
  const labels = reportTexts(language).field;
  const inputs: readonly string[] = AREAS[area].inputs;
  return inputs.flatMap((key) => {
    const input = usable(facts, key);
    if (!input) return [];
    return [
      {
        key,
        label: labels[key] ?? key,
        value: formatValue(key, input.value, language),
        estimated: input.certainty === "estimated",
      },
    ];
  });
}


/** Faltan datos si algún área no tiene veredicto; si no, hay riesgos si alguna es Risk. */
/** Las contradicciones mandan (bloquean); después, faltan datos; después, riesgos. */
export function footerState(verdicts: readonly AreaVerdict[], contradictions = 0): FooterState {
  if (contradictions > 0) return "contradictions";
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

export function reportView(
  idea: string,
  facts: readonly Fact[],
  narrative: StoredNarrative | null,
  approved = false,
): ReportView {
  const verdicts = areaVerdicts(facts);
  const contradictions = findContradictions(facts);
  const footer = footerState(verdicts, contradictions.length);
  const focusVerdict = footer === "missing_data" ? "needs_info" : footer === "risks" ? "risk" : null;
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
      data: dataFor(facts, v.area, language),
    })),
    risks: mainRisks(verdicts).map((v) => ({
      area: v.area,
      verdict: v.verdict,
      sentence: narrative?.risks.find((r) => r.area === v.area)?.sentence.text ?? sentenceOf(v),
    })),
    footer,
    focusArea: verdicts.find((v) => v.verdict === focusVerdict)?.area ?? null,
    contradictions,
    approved,
  };
}