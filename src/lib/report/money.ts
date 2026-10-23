import { FIGURE_KEYS, usable } from "./areas.ts";
import type { Fact } from "./facts.ts";
import { BUDGET_BANDS, type EurRange } from "./figures.ts";

/**
 * Cálculo de Money en código (Jev no hace cuentas). Siempre el caso prudente:
 * coste y gastos máximos, y el extremo bajo del tramo si no hay cifra exacta.
 */

/** Meses hasta el primer ingreso, tomando el extremo alto de cada tramo. */
const MONTHS_TO_REVENUE: Record<string, { months: number; atLeast: boolean }> = {
  Immediate: { months: 1, atLeast: false },
  "0-3 months": { months: 3, atLeast: false },
  "3-12 months": { months: 12, atLeast: false },
  "More than 12 months": { months: 12, atLeast: true },
};

/** Meses mínimos hasta el primer ingreso (extremo bajo de cada tramo): el mejor caso. */
const MIN_MONTHS_TO_REVENUE: Record<string, number> = {
  Immediate: 0,
  "0-3 months": 0,
  "3-12 months": 3,
  "More than 12 months": 12,
};

export interface MoneyCheck {
  /** stated: cifra exacta del usuario; band_floor: extremo bajo de su tramo. */
  budget: { amount: number; basis: "stated" | "band_floor" } | null;
  startupCost: EurRange | null;
  fixedCosts: EurRange | null;
  /** covers: llega al coste máximo; tight: entre mínimo y máximo; short: no llega al mínimo. */
  coverage: "covers" | "tight" | "short" | null;
  /** Lo que falta para cubrir el coste máximo de arranque (0 si llega). */
  shortfall: number | null;
  /** Meses que aguanta con lo que sobra tras arrancar, en el peor caso. */
  runwayMonths: number | null;
  monthsToRevenue: { months: number; atLeast: boolean } | null;
  survivesUntilRevenue: boolean | null;
  /** Abrir con todo el rango: short (ni el mejor caso llega), uncertain (depende del valor real), covers (llega al peor). */
  openingOutcome: "covers" | "short" | "uncertain" | null;
  /** Aguantar hasta el primer ingreso con todo el rango: no (ni el mejor caso), maybe (depende), yes (hasta el peor). */
  runwayOutcome: "yes" | "no" | "maybe" | null;
  /** Algún dato del cálculo es estimado. */
  estimated: boolean;
}

function asRange(value: unknown): EurRange | null {
  if (typeof value !== "object" || value === null) return null;
  const { min, max } = value as Record<string, unknown>;
  return typeof min === "number" && typeof max === "number" && min <= max ? { min, max } : null;
}

export function moneyCheck(facts: readonly Fact[]): MoneyCheck {
  const stated = usable(facts, FIGURE_KEYS.budget);
  const band = usable(facts, "budget_band");
  const bandBounds = band ? BUDGET_BANDS[String(band.value)] : undefined;
  const budget =
    stated && typeof stated.value === "number"
      ? { amount: stated.value, basis: "stated" as const }
      : bandBounds
        ? { amount: bandBounds.min, basis: "band_floor" as const }
        : null;

  const startupInput = usable(facts, FIGURE_KEYS.startupCost);
  const fixedInput = usable(facts, FIGURE_KEYS.fixedCosts);
  const revenueInput = usable(facts, "time_to_revenue");
  const startupCost = startupInput ? asRange(startupInput.value) : null;
  const fixedCosts = fixedInput ? asRange(fixedInput.value) : null;
  const monthsToRevenue = revenueInput ? (MONTHS_TO_REVENUE[String(revenueInput.value)] ?? null) : null;

  const coverage =
    budget && startupCost
      ? budget.amount >= startupCost.max
        ? "covers"
        : budget.amount >= startupCost.min
          ? "tight"
          : "short"
      : null;
  const shortfall = budget && startupCost ? Math.max(0, startupCost.max - budget.amount) : null;

  const runwayMonths =
    budget && startupCost && fixedCosts && fixedCosts.max > 0
      ? Math.max(0, Math.floor((budget.amount - startupCost.max) / fixedCosts.max))
      : null;
  const survivesUntilRevenue =
    runwayMonths !== null && monthsToRevenue ? runwayMonths >= monthsToRevenue.months : null;

  // El presupuesto es un intervalo: cifra exacta = [x, x]; solo el tramo = [suelo, techo del tramo].
  const budgetCeiling = !budget ? null : budget.basis === "stated" ? budget.amount : (bandBounds?.max ?? Infinity);
  const openingOutcome: MoneyCheck["openingOutcome"] =
    budget && budgetCeiling !== null && startupCost
      ? budget.amount >= startupCost.max
        ? "covers"
        : budgetCeiling < startupCost.min
          ? "short"
          : "uncertain"
      : null;

  // Peor caso (coste, gastos y plazo altos) frente a mejor caso (bajos).
  const minMonths = revenueInput ? (MIN_MONTHS_TO_REVENUE[String(revenueInput.value)] ?? null) : null;
  let runwayOutcome: MoneyCheck["runwayOutcome"] = null;
  if (
    openingOutcome === "covers" &&
    budget &&
    budgetCeiling !== null &&
    startupCost &&
    fixedCosts &&
    fixedCosts.max > 0 &&
    monthsToRevenue &&
    minMonths !== null
  ) {
    const worst = Math.floor((budget.amount - startupCost.max) / fixedCosts.max);
    const best = fixedCosts.min > 0 ? Math.floor((budgetCeiling - startupCost.min) / fixedCosts.min) : Infinity;
    runwayOutcome = worst >= monthsToRevenue.months ? "yes" : best < minMonths ? "no" : "maybe";
  }

  const inputs = [stated ?? band, startupInput, fixedInput, revenueInput];
  return {
    budget,
    startupCost,
    fixedCosts,
    coverage,
    shortfall,
    runwayMonths,
    monthsToRevenue,
    survivesUntilRevenue,
    openingOutcome,
    runwayOutcome,
    estimated: inputs.some((input) => input?.certainty === "estimated"),
  };
}