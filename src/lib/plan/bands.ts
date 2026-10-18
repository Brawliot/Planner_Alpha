import type { Range } from "./task.ts";

/**
 * Tramos cerrados que elige Jev (o el catálogo) para las cifras de un paso. El código los convierte
 * en rangos; ningún modelo escribe cifras. Todos son estimados. Jornada de referencia: 8 h.
 */

export const EFFORT_BANDS = {
  under_1h: { min: 0.25, max: 1 },
  "1_4h": { min: 1, max: 4 },
  "4_8h": { min: 4, max: 8 },
  "1_3d": { min: 8, max: 24 },
  "1_2w": { min: 40, max: 80 },
} as const satisfies Record<string, Range>;

/** Euros. */
export const COST_BANDS = {
  free: { min: 0, max: 0 },
  under_100: { min: 0, max: 100 },
  "100_500": { min: 100, max: 500 },
  "500_2000": { min: 500, max: 2000 },
  "2000_10000": { min: 2000, max: 10000 },
} as const satisfies Record<string, Range>;

/** Días de espera a un tercero. */
export const WAIT_BANDS = {
  under_1w: { min: 1, max: 7 },
  "1_4w": { min: 7, max: 28 },
  "1_3m": { min: 30, max: 90 },
  "3_6m": { min: 90, max: 180 },
} as const satisfies Record<string, Range>;

export type EffortBand = keyof typeof EFFORT_BANDS;
export type CostBand = keyof typeof COST_BANDS;
export type WaitBand = keyof typeof WAIT_BANDS;

export const EFFORT_BAND_KEYS = Object.keys(EFFORT_BANDS) as EffortBand[];
export const COST_BAND_KEYS = Object.keys(COST_BANDS) as CostBand[];
export const WAIT_BAND_KEYS = Object.keys(WAIT_BANDS) as WaitBand[];

/** Copia del rango: nadie puede modificar la tabla por referencia. */
export const effortOf = (band: EffortBand): Range => ({ ...EFFORT_BANDS[band] });
export const costOf = (band: CostBand): Range => ({ ...COST_BANDS[band] });
export const waitOf = (band: WaitBand): Range => ({ ...WAIT_BANDS[band] });