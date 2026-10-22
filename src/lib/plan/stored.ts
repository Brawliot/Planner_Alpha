import { z } from "zod";
import { planAnswerSchema, type DraftQuestion, type PlanAnswer } from "./answers.ts";
import { defaultConfig, planConfigSchema, type PlanConfig } from "./config.ts";
import { lineSchema, type Line } from "./line.ts";
import type { PlanState, StoredPlan } from "./orchestrator.ts";
import { nextMonday } from "./prefill.ts";
import { taskSchema, type Task } from "./task.ts";

/**
 * Lo que se guarda del plan y cómo se lee de la BD. El JSON guardado puede ser de una versión
 * anterior o estar dañado: al leerlo se migra y se revisa pieza a pieza. Lo que no encaja se descarta
 * (el motor pone en su sitio la tarea del catálogo al recalcular) y se avisa; nunca rompe la página.
 */

/** Sube cada vez que cambie la forma de StoredPlan, con su migración en MIGRATIONS. */
export const STORED_FORMAT = 1;

/** MIGRATIONS[n] convierte un plan del formato n al n+1. El 0 (sin número) ya tiene la forma del 1. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  0: (raw) => raw,
};

const questionSchema = z.object({
  id: z.string().min(1),
  mold: z.string().min(1),
  text: z.string().min(1),
  options: z.array(z.string()),
});

/** Lo que se guarda del plan recalculado: lo demás (timeline, decisiones, avisos) se recalcula. */
export function toStored(state: PlanState): StoredPlan {
  return {
    formatVersion: STORED_FORMAT,
    lines: state.lines,
    tasks: state.tasks,
    dismissed: state.dismissed,
    fingerprint: state.fingerprint,
    answers: state.answers,
    pendingQuestions: state.pendingQuestions,
  };
}

export interface ReadStored {
  stored: StoredPlan;
  /** Se descartó o corrigió algo: se avisa al usuario y se registra. */
  repaired: boolean;
  /** Qué se reparó (solo para el log del servidor). */
  problems: string[];
}

export function readStored(raw: unknown): ReadStored {
  const problems: string[] = [];
  let data: Record<string, unknown> = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? { ...raw } : {};
  if (Object.keys(data).length === 0) problems.push("stored vacío o no es un objeto");

  let version = typeof data.formatVersion === "number" ? data.formatVersion : 0;
  while (version < STORED_FORMAT && MIGRATIONS[version]) {
    data = MIGRATIONS[version](data);
    version++;
  }

  function list<T>(name: string, value: unknown, schema: z.ZodType<T>, optional = false): T[] {
    if (value === undefined && optional) return [];
    if (!Array.isArray(value)) {
      problems.push(`${name}: no es una lista`);
      return [];
    }
    return value.flatMap((item, index) => {
      const parsed = schema.safeParse(item);
      if (parsed.success) return [parsed.data];
      problems.push(`${name}[${index}] descartado`);
      return [];
    });
  }

  const dismissed = list("dismissed", data.dismissed, z.string());
  const fingerprint = typeof data.fingerprint === "string" ? data.fingerprint : "";
  if (fingerprint === "") problems.push("fingerprint ausente");

  const stored: StoredPlan = {
    formatVersion: STORED_FORMAT,
    lines: list<Line>("lines", data.lines, lineSchema),
    tasks: list<Task>("tasks", data.tasks, taskSchema),
    dismissed,
    fingerprint,
    answers: list<PlanAnswer>("answers", data.answers, planAnswerSchema, true),
    pendingQuestions: list<DraftQuestion>("pendingQuestions", data.pendingQuestions, questionSchema, true),
  };
  return { stored, repaired: problems.length > 0, problems };
}

/** La configuración guardada; si no encaja, los valores por defecto (y se avisa). */
export function readConfig(raw: unknown, today: string): { config: PlanConfig; repaired: boolean } {
  const parsed = planConfigSchema.safeParse(raw);
  if (parsed.success) return { config: parsed.data, repaired: false };
  return { config: defaultConfig(nextMonday(today), { min: 10, max: 20 }), repaired: true };
}