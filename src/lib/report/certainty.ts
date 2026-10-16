import type { Fact } from "./facts.ts";

/**
 * Umbrales medidos con scripts/calibrate-jev.ts el 2026-10-16 contra jev-1.13.0:
 * 60 casos de clasificación y 40 de plausibilidad (ES/EN), 3 ejecuciones cada uno.
 * - Clasificación: sin errores con confianza >= 0,80; el fallo más alto fue 0,76.
 * - Plausibilidad: plausibles >= 0,70, absurdas <= 0,46, dudosas entre 0,59 y 0,68.
 * Solo valen para CALIBRATED_JEV_MODEL. Si cambian el modelo o las preguntas, hay que recalibrar.
 */
export const CALIBRATED_JEV_MODEL = "jev-1.13.0";
export const KNOWN_MIN_CONFIDENCE = 0.85;
export const PLAUSIBLE_MIN_NOUL = 0.7;
export const IMPLAUSIBLE_MAX_NOUL = 0.5;

/** Opción con la que las preguntas de Jev dicen que el texto no lo indica. */
export const NOT_SPECIFIED = "Not specified";

/**
 * known: lo dijo el usuario (con cita) o Jev lo interpreta de su texto con confianza alta.
 * estimated: inferido y validado como plausible; se muestra con la etiqueta "estimated".
 * unknown: no se sabe; candidato a pregunta rápida.
 * discarded: inferencia que Jev considera absurda; no se muestra.
 */
export type Certainty = "known" | "estimated" | "unknown" | "discarded";

export function certaintyOf({ value, source }: Fact): Certainty {
  if (value === NOT_SPECIFIED) return "unknown";

  switch (source.origin) {
    case "user":
      return "known";

    case "jev": {
      // Con un modelo no calibrado, la confianza no significa nada conocido.
      if (source.model !== CALIBRATED_JEV_MODEL || source.confidence === null) return "unknown";
      if (source.confidence < KNOWN_MIN_CONFIDENCE) return "unknown";
      // Interpretar supuestos con seguridad no los convierte en hechos.
      return source.from === "user" ? "known" : "estimated";
    }

    case "gpt": {
      const check = source.plausibility;
      if (!check || check.model !== CALIBRATED_JEV_MODEL) return "unknown";
      if (check.noul >= PLAUSIBLE_MIN_NOUL) return "estimated";
      if (check.noul <= IMPLAUSIBLE_MAX_NOUL) return "discarded";
      return "unknown";
    }
  }
}