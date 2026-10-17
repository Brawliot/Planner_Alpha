import { certaintyOf, type Certainty } from "./certainty.ts";
import type { Fact } from "./facts.ts";
import type { QuestionKey } from "./questions.ts";

/**
 * Áreas del informe. Cuáles aparecen depende de los datos (¿es un local físico?, ¿está regulado?),
 * no del sector: así vale para cualquier negocio y se recalcula sola si el usuario corrige un dato.
 */

/** Cifras que se añaden en el paso 8b (extraídas con cita o estimadas por GPT y validadas por Jev). */
export const FIGURE_KEYS = {
  budget: "budget_eur",
  startupCost: "startup_cost_eur",
  fixedCosts: "monthly_fixed_costs_eur",
  rent: "monthly_rent_eur",
  rentLevel: "rent_level",
} as const;

type FigureKey = (typeof FIGURE_KEYS)[keyof typeof FIGURE_KEYS];
type InputKey = QuestionKey | FigureKey;

/** El área aparece si se cumple alguna condición (dato sabido o estimado con uno de esos valores). */
interface Condition {
  key: QuestionKey;
  anyOf: readonly string[];
}

interface AreaDefinition {
  title: string;
  inputs: readonly InputKey[];
  /** Sin condiciones, el área aparece siempre. */
  appliesWhen?: readonly Condition[];
}

export const AREAS = {
  concept: {
    title: "Concept",
    inputs: ["sector", "offering_type", "revenue_model", "differentiator"],
  },
  validation: {
    title: "Validation",
    inputs: ["validation_stage"],
  },
  market: {
    title: "Market",
    inputs: ["customer_segment", "geographic_scope", "acquisition_channel"],
  },
  competition: {
    title: "Competition",
    inputs: ["competition"],
  },
  money: {
    title: "Money",
    inputs: [
      "budget_band",
      FIGURE_KEYS.budget,
      "capital_intensity",
      FIGURE_KEYS.startupCost,
      FIGURE_KEYS.fixedCosts,
      "time_to_revenue",
    ],
  },
  founder: {
    title: "You",
    inputs: ["founder_experience", "founder_profile", "time_commitment", "launch_timeline"],
  },
  location: {
    title: "Location",
    inputs: ["geographic_scope", FIGURE_KEYS.rent, FIGURE_KEYS.rentLevel],
    appliesWhen: [{ key: "offering_type", anyOf: ["Physical venue"] }],
  },
  regulation: {
    title: "Regulation",
    inputs: ["regulatory_load", "money_handling"],
    appliesWhen: [
      {
        key: "regulatory_load",
        anyOf: ["Moderate (licenses, data protection)", "Heavy (health, finance, food)", "Critical or multi-jurisdiction"],
      },
      // Cobrar con un proveedor de pagos no añade carga real; custodiar dinero ajeno sí.
      { key: "money_handling", anyOf: ["Holds or intermediates funds"] },
    ],
  },
  team: {
    title: "Team",
    inputs: ["team_requirement"],
    appliesWhen: [{ key: "team_requirement", anyOf: ["Large team", "Specialized profiles required"] }],
  },
  dependencies: {
    title: "Dependencies",
    inputs: ["third_party_dependency"],
    appliesWhen: [{ key: "third_party_dependency", anyOf: ["Depends on a platform", "Critical dependency"] }],
  },
} satisfies Record<string, AreaDefinition>;

export type AreaKey = keyof typeof AREAS;
export const AREA_KEYS = Object.keys(AREAS) as AreaKey[];

export interface AreaInput {
  key: string;
  value: unknown;
  certainty: Extract<Certainty, "known" | "estimated">;
}

export interface AreaView {
  area: AreaKey;
  title: string;
  /** Datos utilizables (sabidos o estimados). */
  inputs: AreaInput[];
  /** Entradas sin dato utilizable: no sabidas, descartadas o que faltan. */
  missing: string[];
  /** Algún dato del área es estimado: en pantalla llevará la etiqueta "estimated". */
  estimated: boolean;
}

/** Solo cuentan los datos sabidos o estimados; lo no sabido o descartado no se usa. */
export function usable(facts: readonly Fact[], key: string): AreaInput | null {
  const fact = facts.find((f) => f.key === key);
  if (!fact) return null;
  const certainty = certaintyOf(fact);
  return certainty === "known" || certainty === "estimated" ? { key, value: fact.value, certainty } : null;
}

function applies(definition: AreaDefinition, facts: readonly Fact[]) {
  if (!definition.appliesWhen) return true;
  return definition.appliesWhen.some((condition) => {
    const input = usable(facts, condition.key);
    return input !== null && condition.anyOf.includes(String(input.value));
  });
}

/** Áreas del informe en orden fijo, con sus datos, lo que falta y si hay estimaciones. */
export function buildAreas(facts: readonly Fact[]): AreaView[] {
  return AREA_KEYS.filter((area) => applies(AREAS[area], facts)).map((area) => {
    const definition: AreaDefinition = AREAS[area];
    const inputs = definition.inputs.map((key) => usable(facts, key)).filter((input) => input !== null);
    const present = new Set(inputs.map((input) => input.key));
    return {
      area,
      title: definition.title,
      inputs,
      missing: definition.inputs.filter((key) => !present.has(key)),
      estimated: inputs.some((input) => input.certainty === "estimated"),
    };
  });
}