import type { JevQuestion } from "../jev.ts";
import { AREAS, usable, type AreaKey } from "./areas.ts";
import { certaintyOf } from "./certainty.ts";
import type { Fact } from "./facts.ts";
import type { QuestionKey } from "./questions.ts";

/**
 * Veredicto de Jev para las áreas que necesitan juicio. Calibrado con scripts/calibrate-jev.ts:
 * si cambias el texto o las opciones, hay que recalibrar.
 */

type ChoiceQuestion = Extract<JevQuestion, { type: "choice" }>;

export const NOT_ENOUGH_INFORMATION = "Not enough information";

// Location se decide en código con el nivel de alquiler: Jev no razona bien con cifras (calibración del 9b).
export const JEV_VERDICT_AREAS = ["concept", "market", "founder"] as const satisfies readonly AreaKey[];
export type JevVerdictArea = (typeof JEV_VERDICT_AREAS)[number];

export function isJevVerdictArea(area: AreaKey): area is JevVerdictArea {
  return (JEV_VERDICT_AREAS as readonly AreaKey[]).includes(area);
}

const JUDGE =
  "Use only user_text and the facts given; facts under inferred_not_confirmed are estimates, not certainties.";

function verdictQuestion(subject: string, strong: string, watch: string, risk: string): ChoiceQuestion {
  return {
    type: "choice",
    instructions: `Judge the ${subject} of this business. ${JUDGE}`,
    criteria: {
      Strong: strong,
      Watch: watch,
      Risk: risk,
      [NOT_ENOUGH_INFORMATION]: "The facts given are not enough to judge it",
    },
  };
}

export const VERDICT_QUESTIONS: Record<JevVerdictArea, ChoiceQuestion> = {
  concept: verdictQuestion(
    "concept: what it offers, to whom, how it makes money and what makes it its own",
    "Clear offer, customer and way to make money, with something of its own",
    "Understandable, but generic or with one unclear element",
    "Contradictory or unclear offer, customer or way to make money",
  ),
  market: verdictQuestion(
    "market: whether the customer, the way to reach them and the geographic scope fit together",
    "Customer, channel and scope are consistent and the customers are reachable",
    "Reachable, but through a weak or costly channel, or with a scope too broad or too narrow",
    "The channel or the scope does not fit the customer",
  ),
  founder: verdictQuestion(
    "founder fit: whether the user's experience, skills, dedication and launch timeline fit what this business needs",
    "Experience, skills, dedication and timeline fit what the business needs",
    "One clear gap, such as no experience in the sector or a tight timeline for the dedication",
    "A clear mismatch, such as part-time dedication for a very short launch or no relevant skills for a demanding business",
  ),
};

/** Sin estos datos no se le pregunta a Jev: el área queda en Needs info. */
export const VERDICT_CORE: Record<JevVerdictArea, readonly QuestionKey[]> = {
  concept: ["offering_type"],
  market: ["customer_segment"],
  founder: ["founder_experience", "time_commitment"],
};

export const verdictKey = (area: JevVerdictArea) => `verdict.${area}`;

export function missingCore(facts: readonly Fact[], area: JevVerdictArea) {
  return VERDICT_CORE[area].filter((key) => usable(facts, key) === null);
}

/** Datos utilizables (sabidos o estimados) del área: lo único que ve Jev para juzgarla. */
export function areaFacts(facts: readonly Fact[], area: JevVerdictArea): Fact[] {
  const inputs: readonly string[] = AREAS[area].inputs;
  return facts.filter((fact) => {
    if (!inputs.includes(fact.key)) return false;
    const certainty = certaintyOf(fact);
    return certainty === "known" || certainty === "estimated";
  });
}