import { buildAreas, FIGURE_KEYS, usable, type AreaKey } from "./areas.ts";
import type { Fact } from "./facts.ts";
import { moneyCheck } from "./money.ts";
import { RENT_LEVELS } from "./figures.ts";
import { CATALOG, type QuestionKey } from "./questions.ts";

/**
 * Veredicto por área, decidido siempre en código a partir de los datos: predecible y testeable.
 * Jev clasifica el texto y valida la plausibilidad; no decide veredictos (sus veredictos salían
 * casi siempre con confianza baja y dejaban áreas vacías).
 */

export type Verdict = "strong" | "watch" | "risk" | "needs_info";

export interface AreaVerdict {
  area: AreaKey;
  verdict: Verdict;
  /** Motivo con código estable; las frases y plantillas parten de él. */
  reason: string;
  /** Datos imprescindibles que faltan (solo con needs_info). */
  missing: string[];
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
/** Por encima de este coste de arranque, no validar antes de invertir es un riesgo. */
const UNVALIDATED_INVESTMENT_EUR = 50_000;

const NICHE = option("competition", "Niche with no clear competitors");
const FEW = option("competition", "Few competitors");
const PRICE = option("differentiator", "Price");
const NO_DIFFERENTIATOR = option("differentiator", "None identified");
const QUALITY = option("differentiator", "Quality or experience");
const WEAK_DIFFERENTIATORS = [PRICE, NO_DIFFERENTIATOR];
/** En el concepto, "calidad" tampoco diferencia: casi todos dicen tenerla. */
const GENERIC_CONCEPT = [PRICE, NO_DIFFERENTIATOR, QUALITY];

const FOOT_TRAFFIC = option("acquisition_channel", "Foot traffic or location");
const SELF_SERVICE = option("acquisition_channel", "Online self-service");
const PAID_ADS = option("acquisition_channel", "Paid advertising");
const PUBLIC_SECTOR = option("customer_segment", "Public sector");
const MIXED_SEGMENTS = option("customer_segment", "Mixed segments");
const ONLINE = option("geographic_scope", "Online");
const WIDE_SCOPES = [option("geographic_scope", "National"), option("geographic_scope", "International")];

const NO_EXPERIENCE = option("founder_experience", "None");
const LITTLE_EXPERIENCE = option("founder_experience", "Under 2 years");
const NO_BACKGROUND = option("founder_profile", "No relevant background");
const MANAGES = [option("founder_profile", "Management"), option("founder_profile", "Several areas")];
const UNDER_10H = option("time_commitment", "Under 10 h/week");
const UNDER_20H = [UNDER_10H, option("time_commitment", "10-20 h/week")];
const LAUNCH_UNDER_3M = option("launch_timeline", "Under 3 months");
const LARGE_TEAM = option("team_requirement", "Large team");

function rentLevel(label: (typeof RENT_LEVELS)[number]) {
  return label;
}
const ABOVE_AVERAGE_RENT = rentLevel("Above average");
const PRIME_RENT = rentLevel("Prime location");

const HOLDS_FUNDS = option("money_handling", "Holds or intermediates funds");
const CRITICAL_REGULATION = option("regulatory_load", "Critical or multi-jurisdiction");
const CRITICAL_DEPENDENCY = option("third_party_dependency", "Critical dependency");

type Decision = { verdict: Verdict; reason: string; missing?: string[] };

const needsInfo = (missing: string[]): Decision => ({ verdict: "needs_info", reason: "needs_info", missing });

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
    // Un concepto genérico no tumba un negocio: eso lo marca Competencia. Aquí, como mucho, Vigilar.
    const differentiator = valueOf(facts, "differentiator");
    return differentiator && !GENERIC_CONCEPT.includes(differentiator)
      ? { verdict: "strong", reason: "concept.strong" }
      : { verdict: "watch", reason: "concept.watch" };
  },

  market(facts) {
    const customer = valueOf(facts, "customer_segment");
    if (!customer) return needsInfo(["customer_segment"]);
    const scope = valueOf(facts, "geographic_scope");
    const channel = valueOf(facts, "acquisition_channel");

    if ((channel === FOOT_TRAFFIC && scope === ONLINE) || (channel === SELF_SERVICE && customer === PUBLIC_SECTOR)) {
      return { verdict: "risk", reason: "market.risk" };
    }
    const doubtful =
      (channel === FOOT_TRAFFIC && scope !== null && WIDE_SCOPES.includes(scope)) ||
      customer === MIXED_SEGMENTS ||
      channel === null ||
      channel === PAID_ADS ||
      scope === null;
    return doubtful ? { verdict: "watch", reason: "market.watch" } : { verdict: "strong", reason: "market.strong" };
  },

  founder(facts) {
    const missing = missingOf(facts, ["founder_experience", "time_commitment"]);
    if (missing.length > 0) return needsInfo(missing);
    const experience = valueOf(facts, "founder_experience");
    const time = valueOf(facts, "time_commitment");
    const profile = valueOf(facts, "founder_profile");
    const launch = valueOf(facts, "launch_timeline");
    const team = valueOf(facts, "team_requirement");

    if ((time === UNDER_10H && launch === LAUNCH_UNDER_3M) || (experience === NO_EXPERIENCE && profile === NO_BACKGROUND)) {
      return { verdict: "risk", reason: "founder.risk" };
    }
    const gap =
      experience === NO_EXPERIENCE ||
      experience === LITTLE_EXPERIENCE ||
      (time !== null && UNDER_20H.includes(time)) ||
      (team === LARGE_TEAM && !(profile !== null && MANAGES.includes(profile)));
    return gap ? { verdict: "watch", reason: "founder.watch" } : { verdict: "strong", reason: "founder.strong" };
  },

  money(facts) {
    const check = moneyCheck(facts);
    const missing = [
      ...(check.budget ? [] : ["budget_band"]),
      ...(check.startupCost ? [] : [FIGURE_KEYS.startupCost]),
    ];
    if (missing.length > 0) return needsInfo(missing);
    if (check.coverage === "short") return { verdict: "risk", reason: "money.short" };
    if (check.coverage === "tight") return { verdict: "watch", reason: "money.tight" };
    if (check.survivesUntilRevenue === true) return { verdict: "strong", reason: "money.covers_runway" };
    if (check.survivesUntilRevenue === false) return { verdict: "watch", reason: "money.no_runway" };
    // Cubre el arranque, pero sin gastos fijos o sin plazo de ingresos no se puede confirmar que aguante.
    return { verdict: "watch", reason: "money.runway_unknown" };
  },

  validation(facts) {
    const stage = valueOf(facts, "validation_stage");
    if (!stage) return needsInfo(["validation_stage"]);
    if (VALIDATED.includes(stage)) return { verdict: "strong", reason: "validation.validated" };
    if (stage !== IDEA_ONLY) return { verdict: "watch", reason: "validation.partial" };

    const startupMax = moneyCheck(facts).startupCost?.max ?? 0;
    const bigInvestment = valueOf(facts, "capital_intensity") === HIGH_CAPITAL || startupMax >= UNVALIDATED_INVESTMENT_EUR;
    return bigInvestment
      ? { verdict: "risk", reason: "validation.unvalidated_investment" }
      : { verdict: "watch", reason: "validation.idea_only" };
  },

  competition(facts) {
    const competition = valueOf(facts, "competition");
    if (!competition) return needsInfo(["competition"]);
    const differentiator = valueOf(facts, "differentiator");

    if (competition === NICHE) return { verdict: "strong", reason: "competition.niche" };
    if (competition === FEW) {
      return differentiator
        ? { verdict: "strong", reason: "competition.few" }
        : { verdict: "watch", reason: "competition.few_no_differentiator" };
    }
    // Mercado saturado o dominado por grandes: depende de si hay algo propio que no sea solo precio.
    return differentiator && !WEAK_DIFFERENTIATORS.includes(differentiator)
      ? { verdict: "watch", reason: "competition.crowded_differentiated" }
      : { verdict: "risk", reason: "competition.crowded_undifferentiated" };
  },

  location(facts) {
    const level = valueOf(facts, FIGURE_KEYS.rentLevel);
    if (!level) return needsInfo([FIGURE_KEYS.rentLevel]);
    if (level === PRIME_RENT) {
      // Una zona prime puede ser lo que el negocio busca; el riesgo es tenerla con el dinero justo.
      const coverage = moneyCheck(facts).coverage;
      return coverage === "short" || coverage === "tight"
        ? { verdict: "risk", reason: "location.prime_tight_money" }
        : { verdict: "watch", reason: "location.prime" };
    }
    if (level === ABOVE_AVERAGE_RENT) return { verdict: "watch", reason: "location.above_average" };
    return { verdict: "strong", reason: "location.fits" };
  },

  regulation(facts) {
    if (valueOf(facts, "money_handling") === HOLDS_FUNDS) return { verdict: "risk", reason: "regulation.holds_funds" };
    if (valueOf(facts, "regulatory_load") === CRITICAL_REGULATION) return { verdict: "risk", reason: "regulation.critical" };
    return { verdict: "watch", reason: "regulation.regulated" };
  },

  team() {
    return { verdict: "watch", reason: "team.demanding" };
  },

  dependencies(facts) {
    return valueOf(facts, "third_party_dependency") === CRITICAL_DEPENDENCY
      ? { verdict: "risk", reason: "dependencies.critical" }
      : { verdict: "watch", reason: "dependencies.platform" };
  },
};

/** Veredicto de cada área del informe, en el mismo orden que buildAreas. */
export function areaVerdicts(facts: readonly Fact[]): AreaVerdict[] {
  return buildAreas(facts).map((view) => {
    const decision = RULES[view.area](facts);
    return {
      area: view.area,
      verdict: decision.verdict,
      reason: decision.reason,
      missing: decision.missing ?? [],
      estimated: view.estimated || (view.area === "money" && moneyCheck(facts).estimated),
    };
  });
}