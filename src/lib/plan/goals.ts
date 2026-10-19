import type { Fact } from "../report/facts.ts";
import { founderRiskCauses, option, type FounderCause } from "../report/verdict.ts";
import type { LineSource } from "./line.ts";
import { knownValue, type BusinessState, type FactKey, type FactState, type StateId } from "./states.ts";
import type { Level } from "./task.ts";

/**
 * Objetivos del motor: qué estados tienen que ser verdad para dar una línea por resuelta,
 * y la meta final (negocio abierto y vendiendo) según la forma del negocio y el nivel de lanzamiento.
 */

/** Objetivo de cada motivo rojo de verdict.ts. "founder.risk" depende de la causa (FOUNDER_GOALS). */
export const RISK_GOALS: Record<string, readonly BusinessState[]> = {
  "concept.no_differentiator": ["differentiator_defined"],
  "market.risk": ["channel_fit"],
  "money.short": ["funding_covered"],
  "money.tight": ["funding_covered"],
  "money.no_runway": ["runway_covered"],
  "validation.partial": ["demand_tested"],
  "validation.idea_only": ["problem_confirmed", "demand_tested"],
  "validation.unvalidated_investment": ["problem_confirmed", "demand_tested", "price_tested"],
  "competition.crowded": ["competitors_mapped", "differentiator_defined"],
  "location.prime": ["premises_cost_fit"],
  "location.above_average": ["premises_cost_fit"],
  "regulation.heavy": ["licenses_identified", "licenses_granted"],
  "regulation.critical": ["licenses_identified", "licenses_granted"],
  "regulation.holds_funds": ["licenses_identified", "licenses_granted"],
  "team.demanding": ["roles_defined", "team_hired"],
  "dependencies.critical": ["dependency_mitigated"],
  "dependencies.platform": ["dependency_mitigated"],
};

export const FOUNDER_REASON = "founder.risk";

/** Datos sobre ti que no se averiguan: se completan en el informe, no son tareas del plan. */
export const PERSONAL_KEYS: readonly FactKey[] = ["founder_experience", "founder_profile", "validation_stage"];

const FOUNDER_GOALS: Record<FounderCause, BusinessState> = {
  experience: "founder_gap_covered",
  time: "time_secured",
  team: "roles_defined",
};

/**
 * Estados que resuelven la línea. Conocimiento (gris, por concretar, estimado): saber cada dato.
 * Base: [] (su objetivo sale de la meta de lanzamiento). null: motivo rojo sin objetivo (un test lo impide).
 */
export function lineGoal(source: LineSource, facts: readonly Fact[]): StateId[] | null {
  switch (source.kind) {
    case "risk": {
      if (source.reason === FOUNDER_REASON) return founderRiskCauses(facts).map((cause) => FOUNDER_GOALS[cause]);
      const goal = Object.hasOwn(RISK_GOALS, source.reason) ? RISK_GOALS[source.reason] : null;
      return goal ? [...goal] : null;
    }
    case "needs_info":
    case "gaps":
    case "estimated":
      // Las claves vienen de las áreas del informe (verdict.ts): siempre son claves de datos reales.
      return source.keys
        .filter((key) => !(PERSONAL_KEYS as readonly string[]).includes(key))
        .map((key) => `fact:${key}` as FactState);
    case "base":
      return [];
  }
}

interface LaunchRequirement {
  state: BusinessState;
  /** Nivel de lanzamiento desde el que se pide. */
  from: Level;
  /** Solo si el dato es sabido y es una de estas opciones. Sin condición: siempre. */
  when?: { key: FactKey; anyOf: readonly string[] };
}

/** Lo que pide "abierto y vendiendo" según la forma del negocio. */
export const LAUNCH_REQUIREMENTS: readonly LaunchRequirement[] = [
  { state: "first_customers", from: 1 },
  { state: "legal_entity_ready", from: 1 },
  // Para cobrar hay que poder facturar.
  { state: "accounting_ready", from: 1 },
  { state: "premises_ready", from: 1, when: { key: "offering_type", anyOf: [option("offering_type", "Physical venue")] } },
  {
    state: "mvp_ready",
    from: 1,
    when: {
      key: "offering_type",
      anyOf: [
        option("offering_type", "Software"),
        option("offering_type", "Platform or marketplace"),
        option("offering_type", "Hardware plus software"),
      ],
    },
  },
  {
    state: "website_ready",
    from: 1,
    when: { key: "acquisition_channel", anyOf: [option("acquisition_channel", "Online self-service")] },
  },
  {
    state: "licenses_granted",
    from: 1,
    when: {
      key: "regulatory_load",
      anyOf: [
        option("regulatory_load", "Moderate (licenses, data protection)"),
        option("regulatory_load", "Heavy (health, finance, food)"),
        option("regulatory_load", "Critical or multi-jurisdiction"),
      ],
    },
  },
  {
    state: "suppliers_chosen",
    from: 1,
    when: {
      key: "offering_type",
      anyOf: [option("offering_type", "Physical venue"), option("offering_type", "Physical product")],
    },
  },
  { state: "bank_account_ready", from: 2 },
  { state: "brand_ready", from: 2 },
  { state: "website_ready", from: 3 },
];

/** Meta final: estados que pide el lanzamiento con tu nivel, sin repetidos y en orden de la tabla. */
export function launchGoal(facts: readonly Fact[], launchLevel: Level): BusinessState[] {
  const goal = new Set<BusinessState>();
  for (const requirement of LAUNCH_REQUIREMENTS) {
    if (requirement.from > launchLevel) continue;
    const { when } = requirement;
    if (when) {
      const value = knownValue(facts, when.key);
      if (value === null || !when.anyOf.includes(value)) continue;
    }
    goal.add(requirement.state);
  }
  return [...goal];
}