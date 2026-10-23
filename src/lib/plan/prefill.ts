import { usable } from "../report/areas.ts";
import type { Fact } from "../report/facts.ts";
import { option } from "../report/verdict.ts";
import { defaultConfig, type PlanConfig } from "./config.ts";
import type { Skill } from "./step.ts";
import type { Level, Range } from "./task.ts";
import { addDays, weeklyHoursOf } from "./timeline.ts";

/**
 * Configuración inicial a partir del informe: lo que ya se sabe no se vuelve a preguntar,
 * se muestra relleno con la marca "De tu informe" y es editable. Solo usa datos sabidos o
 * estimados; las correspondencias son conservadoras (sin dato claro, no se rellena).
 */

export interface Prefilled {
  field: "weeklyHours" | "skills" | "validationLevel";
  /** Clave del informe de la que sale. */
  from: string;
  certainty: "known" | "estimated";
}

/** Meses de cada tramo: es el plazo que dijo el usuario, nunca una fecha. "Over 18 months" no tiene tope. */
const LAUNCH_MONTHS: Record<string, Range> = {
  [option("launch_timeline", "Under 3 months")]: { min: 0, max: 3 },
  [option("launch_timeline", "3-6 months")]: { min: 3, max: 6 },
  [option("launch_timeline", "6-12 months")]: { min: 6, max: 12 },
  [option("launch_timeline", "12-18 months")]: { min: 12, max: 18 },
};

/** Plazo que el informe dice (sabido o estimado), en meses; null si no lo dice. */
export function launchTargetOf(facts: readonly Fact[]): Range | null {
  const input = usable(facts, "launch_timeline");
  const value = input ? String(input.value) : null;
  return value !== null && Object.hasOwn(LAUNCH_MONTHS, value) ? { ...LAUNCH_MONTHS[value] } : null;
}

const PROFILE_SKILLS: Record<string, Skill[]> = {
  [option("founder_profile", "Technical")]: ["programming"],
  [option("founder_profile", "Commercial")]: ["sales"],
  [option("founder_profile", "Sector expert")]: ["trade"],
};

/** Cuanto menos validada está la idea, más validación se sugiere. */
const VALIDATION_LEVEL: Record<string, Level> = {
  [option("validation_stage", "Idea only")]: 3,
  [option("validation_stage", "Problem validated")]: 2,
  [option("validation_stage", "Prototype")]: 2,
  [option("validation_stage", "MVP with customers")]: 1,
  [option("validation_stage", "Generating revenue")]: 1,
  [option("validation_stage", "Growing")]: 1,
};

/** Horas por defecto si el informe no sabe la dedicación: se preguntan igualmente. */
const FALLBACK_HOURS = { min: 10, max: 20 };

/** Próximo lunes (si hoy es lunes, el siguiente). Fechas ISO en UTC. */
export function nextMonday(today: string) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, ((8 - weekday) % 7) || 7);
}

export function addMonths(date: string, months: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function prefillConfig(facts: readonly Fact[], today: string): { config: PlanConfig; prefilled: Prefilled[] } {
  const prefilled: Prefilled[] = [];
  const read = (key: string, field: Prefilled["field"]) => {
    const input = usable(facts, key);
    if (!input) return null;
    return { value: String(input.value), mark: () => prefilled.push({ field, from: key, certainty: input.certainty }) };
  };

  const startDate = nextMonday(today);
  const config = defaultConfig(startDate, FALLBACK_HOURS);

  const time = read("time_commitment", "weeklyHours");
  const hours = time ? weeklyHoursOf(time.value) : null;
  if (time && hours) {
    config.weeklyHours = hours;
    time.mark();
  }

  const profile = read("founder_profile", "skills");
  if (profile && Object.hasOwn(PROFILE_SKILLS, profile.value)) {
    config.skills = [...PROFILE_SKILLS[profile.value]];
    profile.mark();
  }

  const stage = read("validation_stage", "validationLevel");
  if (stage && Object.hasOwn(VALIDATION_LEVEL, stage.value)) {
    config.validationLevel = VALIDATION_LEVEL[stage.value];
    stage.mark();
  }

  return { config, prefilled };
}