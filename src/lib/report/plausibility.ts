import type { JevQuestion } from "../jev.ts";

/**
 * Pregunta de plausibilidad para lo que infiere GPT. Calibrada con scripts/calibrate-jev.ts:
 * si cambias el texto, hay que recalibrar PLAUSIBLE_MIN_NOUL e IMPLAUSIBLE_MAX_NOUL.
 */
export const PLAUSIBILITY_QUESTION = {
  type: "noul",
  instructions:
    "Is the assumption in inferred_not_confirmed plausible for the business described in user_text? " +
    "Judge only whether it makes sense for this specific business; the user did not say it.",
  criteria: {
    true: "The assumption is realistic for this business",
    false: "The assumption is unrealistic or contradicts the business described",
  },
} satisfies JevQuestion;