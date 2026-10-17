import { FIGURE_KEYS, usable } from "./areas.ts";
import { certaintyOf, DONT_KNOW } from "./certainty.ts";
import type { Fact } from "./facts.ts";
import { budgetMatchesBand, RENT_LEVELS } from "./figures.ts";
import { improvePrompt } from "./improve.ts";
import { answerOptions, CATALOG, mergeFacts, QUESTION_KEYS, type QuestionKey, type Topic } from "./questions.ts";

/**
 * Edición del informe completo. Solo cuenta lo que cambia: un valor igual al actual conserva su
 * origen (un estimado sigue siendo estimado). Los cambios estructurales obligan a repetir el análisis.
 */

/** Cambian de qué negocio se trata: las estimaciones anteriores dejan de valer. */
export const STRUCTURAL_KEYS: readonly string[] = [
  "sector",
  "offering_type",
  "customer_segment",
  "geographic_scope",
  "revenue_model",
];

const MAX_BUDGET_EUR = 50_000_000;

export type EditTopic = Topic | "location";

export interface EditField {
  key: string;
  topic: EditTopic;
  prompt: string;
  options: string[];
  /** Valor marcado al abrir (null: ninguno). */
  current: string | null;
  estimated: boolean;
}

function isCatalogKey(key: string): key is QuestionKey {
  return Object.hasOwn(CATALOG, key);
}

/** Hechos: solo sus opciones. Estimaciones nuestras: además "I don't know" para retirarlas. */
function optionsFor(key: string): string[] {
  if (key === FIGURE_KEYS.rentLevel) return [...RENT_LEVELS, DONT_KNOW];
  if (!isCatalogKey(key)) return [];
  const options = answerOptions(key);
  return CATALOG[key].mode === "infer" ? [...options, DONT_KNOW] : options;
}

function currentValue(facts: readonly Fact[], key: string) {
  const fact = facts.find((f) => f.key === key);
  if (!fact) return { current: null, estimated: false };
  // Lo que dijo el usuario se muestra siempre, incluido "Not decided yet" o "I don't know".
  if (fact.source.origin === "user") return { current: String(fact.value), estimated: false };
  const certainty = certaintyOf(fact);
  if (certainty === "known" || certainty === "estimated") {
    return { current: String(fact.value), estimated: certainty === "estimated" };
  }
  return { current: null, estimated: false };
}

/** Datos editables: todo el catálogo y, en un local físico, el nivel de alquiler. */
export function editFields(facts: readonly Fact[]): EditField[] {
  const keys: string[] = [...QUESTION_KEYS];
  if (usable(facts, "offering_type")?.value === "Physical venue") keys.push(FIGURE_KEYS.rentLevel);
  return keys.map((key) => ({
    key,
    topic: isCatalogKey(key) ? CATALOG[key].topic : "location",
    prompt: improvePrompt(key),
    options: optionsFor(key),
    ...currentValue(facts, key),
  }));
}

export function currentBudget(facts: readonly Fact[]): number | null {
  const budget = usable(facts, FIGURE_KEYS.budget);
  return typeof budget?.value === "number" ? budget.value : null;
}

export type EditResult =
  | { ok: true; changes: Fact[]; structural: boolean }
  | { ok: false; error: "invalid" | "inconsistent_budget" };

/** Valida en servidor lo enviado y devuelve solo lo que ha cambiado, como datos del usuario. */
export function parseEdits(facts: readonly Fact[], get: (name: string) => unknown): EditResult {
  const changes: Fact[] = [];

  for (const field of editFields(facts)) {
    const value = get(field.key);
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string" || !field.options.includes(value)) return { ok: false, error: "invalid" };
    if (value === field.current) continue;
    changes.push({ key: field.key, value, source: { origin: "user", quote: value } });
  }

  const rawBudget = get(FIGURE_KEYS.budget);
  if (typeof rawBudget === "string" && rawBudget.trim() !== "") {
    const amount = Number(rawBudget);
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_BUDGET_EUR) return { ok: false, error: "invalid" };
    if (amount !== currentBudget(facts)) {
      changes.push({ key: FIGURE_KEYS.budget, value: amount, source: { origin: "user", quote: String(amount) } });
    }
  }

  // Cifra exacta y tramo tienen que cuadrar, cambie el que cambie.
  const edited = mergeFacts(facts, changes);
  const budget = currentBudget(edited);
  if (budget !== null && !budgetMatchesBand(budget, edited)) return { ok: false, error: "inconsistent_budget" };

  return { ok: true, changes, structural: changes.some((change) => STRUCTURAL_KEYS.includes(change.key)) };
}