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
    estimated: inputs.some((input) => input?.certainty === "estimated"),
  };
}