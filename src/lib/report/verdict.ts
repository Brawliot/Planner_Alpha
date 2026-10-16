import { buildAreas, FIGURE_KEYS, usable, type AreaKey } from "./areas.ts";
import type { Fact } from "./facts.ts";
import { moneyCheck } from "./money.ts";
import { CATALOG, type QuestionKey } from "./questions.ts";
import { certaintyOf } from "./certainty.ts";
import { isJevVerdictArea, missingCore, NOT_ENOUGH_INFORMATION, verdictKey } from "./verdict-questions.ts";

/**
 * Veredicto por área. Donde el veredicto sale directamente de los datos, lo decide el código
 * (predecible y testeable). Concept, Market, You y Location necesitan juicio: los decide Jev (paso 9b).
 */

export type Verdict = "strong" | "watch" | "risk" | "needs_info";

export interface AreaVerdict {
  area: AreaKey;
  verdict: Verdict;
  /** Motivo con código estable; el paso 11 lo convierte en frase. */
  reason: string;
  /** code: reglas de este archivo. jev: veredicto de Jev guardado como dato verdict.<área>. */
  decidedBy: "code" | "jev";
  /** Datos imprescindibles que faltan (solo con needs_info). */
  missing: string[];
  /** El veredicto se apoya en algún dato estimado. */
  estimated: boolean;
}

/** Opción del catálogo usada en una regla. Si no existe, falla al cargar: nunca una regla muda por una errata. */
function option(key: QuestionKey, label: string) {
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
const WEAK_DIFFERENTIATORS = [option("differentiator", "Price"), option("differentiator", "None identified")];

const HOLDS_FUNDS = option("money_handling", "Holds or intermediates funds");
const CRITICAL_REGULATION = option("regulatory_load", "Critical or multi-jurisdiction");
const CRITICAL_DEPENDENCY = option("third_party_dependency", "Critical dependency");

type Decision = { verdict: Verdict; reason: string; missing?: string[] };

const needsInfo = (missing: string[]): Decision => ({ verdict: "needs_info", reason: "needs_info", missing });

function valueOf(facts: readonly Fact[], key: string) {
  const input = usable(facts, key);
  return input ? String(input.value) : null;
}

const RULES: Partial<Record<AreaKey, (facts: readonly Fact[]) => Decision>> = {
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

const JEV_VERDICTS: Record<string, Verdict> = {
  Strong: "strong",
  Watch: "watch",
  Risk: "risk",
  [NOT_ENOUGH_INFORMATION]: "needs_info",
};

/** Veredicto de un área juzgada por Jev: solo cuenta si es sabido o estimado (confianza >= umbral). */
function jevDecision(facts: readonly Fact[], area: AreaKey): Decision & { estimated: boolean } {
  if (!isJevVerdictArea(area)) return { ...needsInfo([]), estimated: false };
  const missing = missingCore(facts, area);
  if (missing.length > 0) return { ...needsInfo(missing), estimated: false };

  const fact = facts.find((f) => f.key === verdictKey(area));
  const certainty = fact ? certaintyOf(fact) : "unknown";
  const verdict = fact ? JEV_VERDICTS[String(fact.value)] : undefined;
  if (!verdict || (certainty !== "known" && certainty !== "estimated")) {
    return { verdict: "needs_info", reason: "jev.unsure", estimated: false };
  }
  return { verdict, reason: `${area}.${verdict}`, estimated: certainty === "estimated" };
}

/** Veredicto de cada área del informe, en el mismo orden que buildAreas. */
export function areaVerdicts(facts: readonly Fact[]): AreaVerdict[] {
  return buildAreas(facts).map((view) => {
    const rule = RULES[view.area];
    if (!rule) {
      const decision = jevDecision(facts, view.area);
      return {
        area: view.area,
        verdict: decision.verdict,
        reason: decision.reason,
        decidedBy: "jev",
        missing: decision.missing ?? [],
        estimated: view.estimated || decision.estimated,
      };
    }
    const decision = rule(facts);
    const estimated = view.estimated || (view.area === "money" && moneyCheck(facts).estimated);
    return {
      area: view.area,
      verdict: decision.verdict,
      reason: decision.reason,
      decidedBy: "code",
      missing: decision.missing ?? [],
      estimated,
    };
  });
}