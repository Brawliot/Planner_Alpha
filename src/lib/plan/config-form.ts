import { planConfigSchema, type PlanConfig } from "./config.ts";
import type { Range } from "./task.ts";

/**
 * Formulario corto de configuración (versión mínima; el onboarding completo va después).
 * Solo cambia lo que trae el formulario; el resto de la configuración se conserva.
 */

/** Mismas opciones que la dedicación del informe. */
export const HOURS_OPTIONS = {
  "5-10": { min: 5, max: 10 },
  "10-20": { min: 10, max: 20 },
  "20-40": { min: 20, max: 40 },
  "40": { min: 40, max: 40 },
} as const satisfies Record<string, Range>;
export type HoursOption = keyof typeof HOURS_OPTIONS;

/** Opción que corresponde a unas horas; null si no es ninguna (la pantalla marca la más cercana). */
export function hoursOptionOf(range: Range): HoursOption | null {
  const found = (Object.keys(HOURS_OPTIONS) as HoursOption[]).find(
    (key) => HOURS_OPTIONS[key].min === range.min && HOURS_OPTIONS[key].max === range.max,
  );
  return found ?? null;
}

export type ConfigFormResult = { ok: true; config: PlanConfig } | { ok: false; error: string };

export function parseConfigForm(
  current: PlanConfig,
  get: (name: string) => unknown,
  getAll: (name: string) => unknown[],
): ConfigFormResult {
  const hours = get("hours");
  if (typeof hours !== "string" || !Object.hasOwn(HOURS_OPTIONS, hours)) {
    return { ok: false, error: "Elige cuántas horas por semana le dedicarás." };
  }
  const delegation = getAll("delegation");
  if (delegation.length === 0) return { ok: false, error: "Marca al menos una forma de repartir el trabajo." };

  const targetDate = get("targetDate");
  const candidate = {
    ...current,
    startDate: get("startDate"),
    // Vacío = sin fecha límite (también borra la que hubiera).
    targetDate: typeof targetDate === "string" && targetDate !== "" ? targetDate : undefined,
    weeklyHours: { ...HOURS_OPTIONS[hours as HoursOption] },
    delegation,
    professionals: getAll("professionals"),
    validationLevel: Number(get("validationLevel")),
    launchLevel: Number(get("launchLevel")),
  };
  const parsed = planConfigSchema.safeParse(candidate);
  return parsed.success ? { ok: true, config: parsed.data } : { ok: false, error: "Revisa los datos del formulario." };
}