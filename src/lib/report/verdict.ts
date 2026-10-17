import { buildAreas, FIGURE_KEYS, usable, type AreaKey } from "./areas.ts";
import type { Fact } from "./facts.ts";
import { moneyCheck } from "./money.ts";
import { RENT_LEVELS } from "./figures.ts";
import { CATALOG, type QuestionKey } from "./questions.ts";

/**
 * Veredicto por área, decidido siempre en código a partir de lo que SE SABE (sabido o estimado):
 * - strong (verde): el hecho tiene efecto positivo o neutro;
 * - risk (rojo): el hecho tiene efecto negativo; no es "mala idea", es una línea de trabajo del plan;
 * - needs_info (gris): falta lo imprescindible para dar color.
 * No saber algo nunca cuenta como negativo: va a gaps ("por concretar") y será una tarea del plan.
 * watch ya no lo da ninguna regla; sale del tipo en el paso V2.
 */

export type Verdict = "strong" | "watch" | "risk" | "needs_info";

export interface AreaVerdict {
  area: AreaKey;
  verdict: Verdict;
  /** Motivo con código estable; las frases y plantillas parten de él. */
  reason: string;
  /** Datos imprescindibles que faltan (solo con needs_info). */
  missing: string[];
  /** Datos del área que no se saben pero no cambian el color: "por concretar". */
  gaps: string[];
  /** El veredicto se apoya en algún dato estimado. */
  estimated: boolean;
}

/** Opción del catálogo usada en una regla. Si no existe, falla al cargar: nunca una regla muda por una errata. */
export function option(key: QuestionKey, label: string) {
  if (!Object.hasOwn(CATALOG[key].jev.criteria, label)) {
    throw new Error(`verdict: "${label}" no es una opción de ${key}`);
  }
  return label;
}

const VALIDATED = [
  option("validation_stage", "MVP with customers"),
  option("validation_stage", "Generating revenue"),
  option("validation_stage", "Growing"),
];
const IDEA_ONLY = option("validation_stage", "Idea only");
const HIGH_CAPITAL = option("capital_intensity", "High (inventory, equipment, premises or R&D)");
/** Por encima de este coste de arranque, no validar antes de invertir se explica aparte. */
const UNVALIDATED_INVESTMENT_EUR = 50_000;

const NICHE = option("competition", "Niche with no clear competitors");
const FEW = option("competition", "Few competitors");
const NO_DIFFERENTIATOR = option("differentiator", "None identified");

const FOOT_TRAFFIC = option("acquisition_channel", "Foot traffic or location");
const SELF_SERVICE = option("acquisition_channel", "Online self-service");
const PUBLIC_SECTOR = option("customer_segment", "Public sector");
const ONLINE = option("geographic_scope", "Online");
const WIDE_SCOPES = [option("geographic_scope", "National"), option("geographic_scope", "International")];

const LITTLE_EXPERIENCE = [option("founder_experience", "None"), option("founder_experience", "Under 2 years")];
const MANAGES = [option("founder_profile", "Management"), option("founder_profile", "Several areas")];
const UNDER_20H = [option("time_commitment", "Under 10 h/week"), option("time_commitment", "10-20 h/week")];
const LARGE_TEAM = option("team_requirement", "Large team");

function rentLevel(label: (typeof RENT_LEVELS)[number]) {
  return label;
}
const ABOVE_AVERAGE_RENT = rentLevel("Above average");
const PRIME_RENT = rentLevel("Prime location");

const HOLDS_FUNDS = option("money_handling", "Holds or intermediates funds");
const HEAVY_REGULATION = option("regulatory_load", "Heavy (health, finance, food)");
const CRITICAL_REGULATION = option("regulatory_load", "Critical or multi-jurisdiction");
const CRITICAL_DEPENDENCY = option("third_party_dependency", "Critical dependency");

type Decision = { verdict: Verdict; reason: string; missing?: string[] };

const needsInfo = (missing: string[]): Decision => ({ verdict: "needs_info", reason: "needs_info", missing });
const green = (reason: string): Decision => ({ verdict: "strong", reason });
const red = (reason: string): Decision => ({ verdict: "risk", reason });

function valueOf(facts: readonly Fact[], key: string) {
  const input = usable(facts, key);
  return input ? String(input.value) : null;
}

/** Datos imprescindibles que faltan (no sabidos o descartados). */
function missingOf(facts: readonly Fact[], keys: string[]) {
  return keys.filter((key) => valueOf(facts, key) === null);
}

const RULES: Record<AreaKey, (facts: readonly Fact[]) => Decision> = {
  concept(facts) {
    const missing = missingOf(facts, ["offering_type", "revenue_model"]);
    if (missing.length > 0) return needsInfo(missing);
    // Precio o calidad son neutros (verde). Rojo solo si se sabe que no hay nada propio.
    return valueOf(facts, "differentiator") === NO_DIFFERENTIATOR ? red("concept.no_differentiator") : green("concept.strong");
  },

  market(facts) {
    const customer = valueOf(facts, "customer_segment");
    if (!customer) return needsInfo(["customer_segment"]);
    const scope = valueOf(facts, "geographic_scope");
    const channel = valueOf(facts, "acquisition_channel");
    // Solo las combinaciones que no encajan; un canal o alcance desconocido va a gaps.
    const incoherent =
      (channel === FOOT_TRAFFIC && scope !== null && (scope === ONLINE || WIDE_SCOPES.includes(scope))) ||
      (channel === SELF_SERVICE && customer === PUBLIC_SECTOR);
    return incoherent ? red("market.risk") : green("market.strong");
  },

  founder(facts) {
    const missing = missingOf(facts, ["founder_experience", "time_commitment"]);
    if (missing.length > 0) return needsInfo(missing);
    const experience = valueOf(facts, "founder_experience");
    const time = valueOf(facts, "time_commitment");
    const profile = valueOf(facts, "founder_profile");
    const team = valueOf(facts, "team_requirement");

    const gap =
      (experience !== null && LITTLE_EXPERIENCE.includes(experience)) ||
      (time !== null && UNDER_20H.includes(time)) ||
      (team === LARGE_TEAM && !(profile !== null && MANAGES.includes(profile)));
    return gap ? red("founder.risk") : green("founder.strong");
  },

  money(facts) {
    const check = moneyCheck(facts);
    const missing = [
      ...(check.budget ? [] : ["budget_band"]),
      ...(check.startupCost ? [] : [FIGURE_KEYS.startupCost]),
    ];
    if (missing.length > 0) return needsInfo(missing);
    if (check.coverage === "short") return red("money.short");
    if (check.coverage === "tight") return red("money.tight");
    if (check.survivesUntilRevenue === false) return red("money.no_runway");
    if (check.survivesUntilRevenue === true) return green("money.covers_runway");
    // Cubre el arranque; los gastos fijos o el plazo de ingresos que faltan quedan por concretar.
    return green("money.runway_unknown");
  },

  validation(facts) {
    const stage = valueOf(facts, "validation_stage");
    if (!stage) return needsInfo(["validation_stage"]);
    if (VALIDATED.includes(stage)) return green("validation.validated");
    if (stage !== IDEA_ONLY) return red("validation.partial");

    const startupMax = moneyCheck(facts).startupCost?.max ?? 0;
    const bigInvestment = valueOf(facts, "capital_intensity") === HIGH_CAPITAL || startupMax >= UNVALIDATED_INVESTMENT_EUR;
    return red(bigInvestment ? "validation.unvalidated_investment" : "validation.idea_only");
  },

  competition(facts) {
    const competition = valueOf(facts, "competition");
    if (!competition) return needsInfo(["competition"]);
    if (competition === NICHE) return green("competition.niche");
    if (competition === FEW) return green("competition.few");
    // Saturado o dominado por grandes: un hecho que pide trabajar cómo destacar.
    return red("competition.crowded");
  },

  location(facts) {
    const level = valueOf(facts, FIGURE_KEYS.rentLevel);
    if (!level) return needsInfo([FIGURE_KEYS.rentLevel]);
    if (level === PRIME_RENT) return red("location.prime");
    if (level === ABOVE_AVERAGE_RENT) return red("location.above_average");
    return green("location.fits");
  },

  regulation(facts) {
    if (valueOf(facts, "money_handling") === HOLDS_FUNDS) return red("regulation.holds_funds");
    const load = valueOf(facts, "regulatory_load");
    if (load === CRITICAL_REGULATION) return red("regulation.critical");
    if (load === HEAVY_REGULATION) return red("regulation.heavy");
    // El área solo aparece con carga moderada o mayor: aquí es moderada, el trámite normal.
    return green("regulation.moderate");
  },

  team() {
    // Solo aparece con equipo grande o perfiles especializados: siempre hay que contratar.
    return red("team.demanding");
  },

  dependencies(facts) {
    return red(valueOf(facts, "third_party_dependency") === CRITICAL_DEPENDENCY ? "dependencies.critical" : "dependencies.platform");
  },
};

/** Veredicto de cada área del informe, en el mismo orden que buildAreas. */
export function areaVerdicts(facts: readonly Fact[]): AreaVerdict[] {
  return buildAreas(facts).map((view) => {
    const decision = RULES[view.area](facts);
    const missing = decision.missing ?? [];
    return {
      area: view.area,
      verdict: decision.verdict,
      reason: decision.reason,
      missing,
      // El presupuesto exacto es opcional si se sabe el tramo: no queda "por concretar".
      gaps: view.missing.filter((key) => key !== FIGURE_KEYS.budget && !missing.includes(key)),
      estimated: view.estimated || (view.area === "money" && moneyCheck(facts).estimated),
    };
  });
}