import { FIGURE_KEYS, usable } from "./areas.ts";
import type { Fact } from "./facts.ts";
import { option } from "./verdict.ts";

/**
 * Contradicciones: dos datos que no pueden ser ciertos a la vez. Bloquean la aprobación.
 * Una mala combinación que sí es posible no es contradicción: es un riesgo y la juzgan los veredictos.
 */

export type ContradictionId = "online_with_premises" | "commission_without_money" | "marketplace_with_own_offer";

export interface Contradiction {
  id: ContradictionId;
  /** Alguno de los datos implicados es una estimación nuestra (se puede corregir o retirar). */
  estimated: boolean;
}

const ONLINE = option("geographic_scope", "Online");
const PHYSICAL_VENUE = option("offering_type", "Physical venue");
const PHYSICAL_PRODUCT = option("offering_type", "Physical product");
const COMMISSION = option("revenue_model", "Transaction commission");
const NO_MONEY = option("money_handling", "No third-party money");
const MARKETPLACE = option("customer_segment", "Two-sided marketplace");

export function findContradictions(facts: readonly Fact[]): Contradiction[] {
  const value = (key: string) => {
    const input = usable(facts, key);
    return input ? String(input.value) : null;
  };
  const anyEstimated = (keys: string[]) => keys.some((key) => usable(facts, key)?.certainty === "estimated");
  const found: Contradiction[] = [];

  // Un negocio puramente digital no tiene local.
  const hasPremises = value("offering_type") === PHYSICAL_VENUE || usable(facts, FIGURE_KEYS.rentLevel) !== null;
  if (value("geographic_scope") === ONLINE && hasPremises) {
    found.push({ id: "online_with_premises", estimated: anyEstimated(["geographic_scope", "offering_type", FIGURE_KEYS.rentLevel]) });
  }

  // Cobrar comisión por transacción implica que el dinero de otros pasa por ti.
  if (value("revenue_model") === COMMISSION && value("money_handling") === NO_MONEY) {
    found.push({ id: "commission_without_money", estimated: anyEstimated(["revenue_model", "money_handling"]) });
  }

  // Un marketplace conecta a dos partes; un local o un producto propio, no.
  const ownOffer = [PHYSICAL_VENUE, PHYSICAL_PRODUCT].includes(value("offering_type") ?? "");
  if (value("customer_segment") === MARKETPLACE && ownOffer) {
    found.push({ id: "marketplace_with_own_offer", estimated: anyEstimated(["customer_segment", "offering_type"]) });
  }

  return found;
}