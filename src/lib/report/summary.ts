import { z } from "zod";
import type { Fact } from "./facts.ts";
import { allowedNumbers, extractNumbers, narrativeInput, numbersAreAllowed } from "./narrative.ts";
import type { AreaVerdict } from "./verdict.ts";

/**
 * Resumen ejecutivo del informe. GPT lo redacta en la misma llamada que las frases de las áreas;
 * el código decide qué partes existen, revisa cada número y marca su certeza (de ti / estimado).
 */

export const SUMMARY_KEYS = ["lead", "strengths", "work", "unknown", "next"] as const;
export type SummaryKey = (typeof SUMMARY_KEYS)[number];

export const SUMMARY_LIMITS: Record<SummaryKey, number> = {
  lead: 200,
  strengths: 400,
  work: 400,
  unknown: 400,
  next: 250,
};

/** Mismo margen de redondeo que las frases de las áreas (narrative.ts). */
const NUMBER_TOLERANCE = 0.05;

export type Certainty = "known" | "estimated";

/** Trozo de texto; las cifras llevan su certeza para pintarlas con su marca. */
export interface Segment {
  text: string;
  certainty?: Certainty;
}

export type Summary = { lead: Segment[]; next: Segment[] } & Partial<Record<"strengths" | "work" | "unknown", Segment[]>>;

/** Lo que devuelve GPT, antes de revisarlo. */
export type SummaryResult = Partial<Record<SummaryKey, string>>;

/** Partes del resumen según los veredictos: sin áreas a trabajar no hay "Lo que hay que trabajar". */
export function summaryKeys(verdicts: readonly AreaVerdict[]): SummaryKey[] {
  const has = (verdict: AreaVerdict["verdict"]) => verdicts.some((v) => v.verdict === verdict);
  return SUMMARY_KEYS.filter((key) =>
    key === "strengths" ? has("strong") : key === "work" ? has("risk") : key === "unknown" ? has("needs_info") : true,
  );
}

// ---- Lo que recibe GPT (se suma a la petición de las frases)

export const SUMMARY_INSTRUCTIONS = [
  "Also write summary: an executive summary of the whole idea for its founder.",
  `summary.lead is one sentence of at most ${SUMMARY_LIMITS.lead} characters with the overall situation.`,
  "summary.strengths explains what is most solid (areas with verdict strong), summary.work what needs work (verdict risk)",
  `and summary.unknown what is not known yet (the areas in unknown_areas); each at most ${SUMMARY_LIMITS.strengths} characters.`,
  `summary.next is the single most useful next step, at most ${SUMMARY_LIMITS.next} characters, taken from what needs work or is unknown.`,
  "In the summary, never invent tasks, facts or numbers: the same number rules apply, using only the data given.",
].join(" ");

export function summaryInput(idea: string, facts: readonly Fact[], verdicts: readonly AreaVerdict[]) {
  return {
    ...narrativeInput(idea, facts, verdicts),
    unknown_areas: verdicts.filter((v) => v.verdict === "needs_info").map((v) => v.area),
  };
}

type JsonSchemaFormat = {
  name: string;
  schema: Record<string, unknown> & { required: string[]; properties: Record<string, unknown> };
};

/** Añade summary al esquema de respuesta, solo con las partes que tocan (strict: todas obligatorias). */
export function withSummaryFormat<F extends JsonSchemaFormat>(format: F, verdicts: readonly AreaVerdict[]): F {
  const keys = summaryKeys(verdicts);
  const summary = {
    type: "object",
    additionalProperties: false,
    required: keys,
    properties: Object.fromEntries(keys.map((key) => [key, { type: "string" }])),
  };
  return {
    ...format,
    schema: {
      ...format.schema,
      required: [...format.schema.required, "summary"],
      properties: { ...format.schema.properties, summary },
    },
  };
}

/** Si el resumen viene mal formado o no viene, queda null: las frases de las áreas no se pierden. */
export function withSummaryParser<T>(base: z.ZodType<T>): z.ZodType<T & { summary: SummaryResult | null }> {
  const text = z.string().transform((s) => s.replace(/\s+/g, " ").trim());
  const summary = z.record(z.string(), text).nullable().catch(null);
  return base.and(z.object({ summary })) as unknown as z.ZodType<T & { summary: SummaryResult | null }>;
}

// ---- Revisión y marcado

type AreaInput = ReturnType<typeof narrativeInput>["areas"][string];

/**
 * Certeza de cada número: sabido si viene de la idea o de un dato del usuario; estimado si viene de
 * una estimación o de una cifra calculada a partir de ellas. Si coincide con ambos, estimado:
 * nunca se presenta como seguro algo que quizá no lo es.
 */
function certaintyOfNumbers(idea: string, areas: Record<string, AreaInput>) {
  const known = allowedNumbers(idea);
  const estimated: number[] = [];
  for (const area of Object.values(areas)) {
    for (const item of area.data) (item.estimated ? estimated : known).push(...allowedNumbers(item.value));
    if ("figures" in area && area.figures) {
      // El presupuesto es del usuario (cifra exacta o suelo del tramo que eligió); el resto se calcula con estimaciones.
      const { budget_eur: _budget, budget_is_band_floor: _floor, ...derived } = area.figures;
      estimated.push(...allowedNumbers(derived));
    }
  }
  const near = (list: readonly number[], n: number) =>
    list.some((a) => (a === 0 ? n === 0 : Math.abs(n - a) <= Math.abs(a) * NUMBER_TOLERANCE));
  return (n: number): Certainty => (near(estimated, n) || !near(known, n) ? "estimated" : "known");
}

/** Cifra (con k, rango y € o % opcionales): "40.000 €", "45.000–60.000 €", "45k", "12 %". */
const FIGURE = /\d+(?:[.,]\d+)*(?:\s?[kK](?![a-zA-Z]))?(?:\s?[–-]\s?\d+(?:[.,]\d+)*(?:\s?[kK](?![a-zA-Z]))?)?(?:\s?[€%])?/g;

export function toSegments(text: string, certaintyOf: (n: number) => Certainty): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(FIGURE)) {
    const start = match.index;
    if (start > last) segments.push({ text: text.slice(last, start) });
    const estimated = extractNumbers(match[0]).some((n) => certaintyOf(n) === "estimated");
    segments.push({ text: match[0], certainty: estimated ? "estimated" : "known" });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

/**
 * Resumen revisado, o null. Cada parte que toca debe existir, caber en su límite y no traer números
 * que no estén en los datos. Si una falla, no hay resumen: uno con huecos confunde más que ninguno.
 */
export function buildSummary(
  result: SummaryResult | null | undefined,
  idea: string,
  facts: readonly Fact[],
  verdicts: readonly AreaVerdict[],
): Summary | null {
  if (!result) return null;
  const { areas } = summaryInput(idea, facts, verdicts);
  const allowed = allowedNumbers(idea, areas);
  const certaintyOf = certaintyOfNumbers(idea, areas);

  const parts: Partial<Record<SummaryKey, Segment[]>> = {};
  for (const key of summaryKeys(verdicts)) {
    const text = result[key];
    if (!text || text.length > SUMMARY_LIMITS[key] || !numbersAreAllowed(text, allowed)) return null;
    parts[key] = toSegments(text, certaintyOf);
  }
  return parts as Summary;
}