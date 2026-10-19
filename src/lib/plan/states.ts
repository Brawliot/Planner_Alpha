import { FIGURE_KEYS, usable } from "../report/areas.ts";
import { moneyCheck } from "../report/money.ts";
import type { Fact } from "../report/facts.ts";
import type { Language } from "../report/narrative.ts";
import type { QuestionKey } from "../report/questions.ts";
import { option } from "../report/verdict.ts";
import type { PlanConfig } from "./config.ts";
import type { MILESTONES } from "./task.ts";

/**
 * Estados del motor: frases de sí o no sobre la situación del negocio. Vocabulario cerrado:
 * ni la IA ni el usuario pueden inventar uno. Nunca se guardan: se calculan siempre desde el
 * informe, la configuración (hitos) y las tareas terminadas. Lo estimado no hace verdad un estado.
 */

/** Estados de negocio. La lista crece con el catálogo de moldes. */
export const BUSINESS_STATES = [
  "problem_confirmed",
  "demand_tested",
  "price_tested",
  "mvp_ready",
  "first_customers",
  "differentiator_defined",
  "competitors_mapped",
  "channel_fit",
  "funding_covered",
  "runway_covered",
  "premises_cost_fit",
  "premises_signed",
  "premises_ready",
  "licenses_identified",
  "licenses_granted",
  "legal_entity_ready",
  "bank_account_ready",
  "website_ready",
  "brand_ready",
  "suppliers_chosen",
  "offer_defined",
  "roles_defined",
  "team_hired",
  "dependency_mitigated",
  "time_secured",
  "founder_gap_covered",
] as const;
export type BusinessState = (typeof BUSINESS_STATES)[number];

/** Claves del informe que pueden ser un estado de conocimiento. */
export type FactKey = QuestionKey | (typeof FIGURE_KEYS)[keyof typeof FIGURE_KEYS];
/** Estado de conocimiento: el dato del informe es sabido. */
export type FactState = `fact:${FactKey}`;
export type StateId = BusinessState | FactState;

export const factState = (key: FactKey): FactState => `fact:${key}`;

export const BUSINESS_STATE_LABELS: Record<BusinessState, Record<Language, string>> = {
  problem_confirmed: { en: "Problem confirmed", es: "Problema confirmado" },
  demand_tested: { en: "Demand tested", es: "Demanda probada" },
  price_tested: { en: "Price tested", es: "Precio probado" },
  mvp_ready: { en: "First version built", es: "Primera versión construida" },
  first_customers: { en: "First customers", es: "Primeros clientes" },
  differentiator_defined: { en: "Differentiator defined", es: "Diferenciación definida" },
  competitors_mapped: { en: "Competitors mapped", es: "Competencia analizada" },
  channel_fit: { en: "Channel fits the customer", es: "Canal adecuado a tu cliente" },
  funding_covered: { en: "Funding covered", es: "Financiación cubierta" },
  runway_covered: { en: "Runway covered", es: "Margen hasta ingresar cubierto" },
  premises_cost_fit: { en: "Premises cost fits", es: "Coste del local ajustado" },
  premises_signed: { en: "Premises signed", es: "Local firmado" },
  premises_ready: { en: "Premises ready", es: "Local listo" },
  licenses_identified: { en: "Licenses identified", es: "Licencias identificadas" },
  licenses_granted: { en: "Licenses granted", es: "Licencias concedidas" },
  legal_entity_ready: { en: "Business registered", es: "Empresa dada de alta" },
  bank_account_ready: { en: "Business bank account", es: "Cuenta bancaria del negocio" },
  website_ready: { en: "Website ready", es: "Web lista" },
  brand_ready: { en: "Brand ready", es: "Marca lista" },
  suppliers_chosen: { en: "Suppliers chosen", es: "Proveedores elegidos" },
  offer_defined: { en: "Offer and prices defined", es: "Oferta y precios definidos" },
  roles_defined: { en: "Roles defined", es: "Puestos definidos" },
  team_hired: { en: "Team hired", es: "Equipo contratado" },
  dependency_mitigated: { en: "Dependency mitigated", es: "Dependencia reducida" },
  time_secured: { en: "Time secured", es: "Tiempo asegurado" },
  founder_gap_covered: { en: "Founder gap covered", es: "Carencia del fundador cubierta" },
};

/** Lo que dice el informe (solo datos sabidos). "Prototype" no da mvp_ready: puede ser solo un boceto. */
const VALIDATION_STATES: Record<string, BusinessState[]> = {
  [option("validation_stage", "Problem validated")]: ["problem_confirmed"],
  [option("validation_stage", "Prototype")]: ["problem_confirmed"],
  [option("validation_stage", "MVP with customers")]: ["problem_confirmed", "mvp_ready", "demand_tested", "first_customers"],
  [option("validation_stage", "Generating revenue")]: [
    "problem_confirmed",
    "mvp_ready",
    "demand_tested",
    "first_customers",
    "price_tested",
  ],
  [option("validation_stage", "Growing")]: [
    "problem_confirmed",
    "mvp_ready",
    "demand_tested",
    "first_customers",
    "price_tested",
  ],
};
const NO_DIFFERENTIATOR = option("differentiator", "None identified");

/** Lo que marca el usuario en "¿qué tienes ya hecho?". */
export const MILESTONE_STATES: Record<(typeof MILESTONES)[number], BusinessState> = {
  legal_entity: "legal_entity_ready",
  business_bank_account: "bank_account_ready",
  premises: "premises_ready",
  website: "website_ready",
  brand: "brand_ready",
  suppliers: "suppliers_chosen",
  licenses: "licenses_granted",
  funding: "funding_covered",
};

/** Si es verdad lo primero, también lo segundo: lo que lo precede por fuerza. */
const IMPLIED: readonly (readonly [BusinessState, BusinessState])[] = [
  ["premises_ready", "premises_signed"],
  ["licenses_granted", "licenses_identified"],
  ["price_tested", "demand_tested"],
  ["demand_tested", "problem_confirmed"],
  ["first_customers", "offer_defined"],
];

export type StateOrigin =
  | { kind: "report"; key: string }
  | { kind: "milestone"; milestone: (typeof MILESTONES)[number] }
  | { kind: "plan"; taskId: string };

/** Valor del dato solo si es sabido: lo estimado nunca hace verdad un estado. */
export const knownValue = (facts: readonly Fact[], key: string) => {
  const input = usable(facts, key);
  return input?.certainty === "known" ? String(input.value) : null;
};

/**
 * Estados que ya son verdad y de dónde sale cada uno (el primero por orden: informe, hito, tarea).
 * achieved: lo que consiguen las tareas terminadas del plan, ya calculado por quien llama.
 */
export function currentStates(input: {
  facts: readonly Fact[];
  config: Pick<PlanConfig, "done">;
  achieved: readonly { state: StateId; taskId: string }[];
}): Map<StateId, StateOrigin> {
  const states = new Map<StateId, StateOrigin>();
  const add = (state: StateId, origin: StateOrigin) => {
    if (!states.has(state)) states.set(state, origin);
  };

  for (const fact of input.facts) {
    if (knownValue(input.facts, fact.key) !== null) add(`fact:${fact.key}` as FactState, { kind: "report", key: fact.key });
  }

  const stage = knownValue(input.facts, "validation_stage");
  if (stage !== null && Object.hasOwn(VALIDATION_STATES, stage)) {
    for (const state of VALIDATION_STATES[stage]) add(state, { kind: "report", key: "validation_stage" });
  }
  const differentiator = knownValue(input.facts, "differentiator");
  if (differentiator !== null && differentiator !== NO_DIFFERENTIATOR) {
    add("differentiator_defined", { kind: "report", key: "differentiator" });
  }

  // El presupuesto cubre el arranque y nada es estimado: la financiación ya está.
  const money = moneyCheck(input.facts);
  if (money.coverage === "covers" && !money.estimated && money.budget) {
    add("funding_covered", { kind: "report", key: money.budget.basis === "stated" ? FIGURE_KEYS.budget : "budget_band" });
  }

  for (const milestone of input.config.done) add(MILESTONE_STATES[milestone], { kind: "milestone", milestone });
  for (const { state, taskId } of input.achieved) add(state, { kind: "plan", taskId });

  for (let changed = true; changed; ) {
    changed = false;
    for (const [state, implied] of IMPLIED) {
      const origin = states.get(state);
      if (origin && !states.has(implied)) {
        states.set(implied, origin);
        changed = true;
      }
    }
  }
  return states;
}