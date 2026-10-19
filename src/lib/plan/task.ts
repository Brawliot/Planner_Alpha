import { z } from "zod";
import { findCycle, unknownDependencies } from "./graph.ts";
import { stepSchema, type Step } from "./step.ts";

/**
 * Tarea del plan: lo que se planifica (fase, dependencias, estado). No tiene actor propio
 * ni cifras guardadas: esfuerzo, espera, coste y estado se derivan siempre de sus pasos.
 * Las dependencias son un bloqueo blando: se puede avanzar igualmente, pero queda a la vista.
 */

export const PHASES = ["validate", "prepare", "launch", "operate"] as const;
export const TASK_KINDS = ["research", "decision", "check", "action"] as const;
export const VALIDATION_MODES = ["per_step", "together"] as const;
/** catalog: esqueleto del código. ai: sugerida por la IA (se muestra "Sugerida por IA" y se puede quitar). */
export const TASK_ORIGINS = ["catalog", "ai"] as const;
/** Hitos que el usuario puede tener ya hechos (pregunta "¿qué tienes ya hecho?"). */
export const MILESTONES = [
  "legal_entity",
  "business_bank_account",
  "premises",
  "website",
  "brand",
  "suppliers",
  "licenses",
  "funding",
] as const;
/** Nivel 1 = lo justo; 3 = a fondo / completo. */
export const LEVELS = [1, 2, 3] as const;
export type Level = (typeof LEVELS)[number];
const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const taskSchema = z
  .object({
    id: z.string().min(1),
    lineId: z.string().min(1),
    phase: z.enum(PHASES),
    kind: z.enum(TASK_KINDS),
    title: z.string().min(1),
    outcome: z.string().min(1),
    dependsOn: z.array(z.string().min(1)),
    /** Datos del informe en que se apoya: de aquí sale su certeza. */
    basis: z.array(z.string().min(1)),
    /** Dato del informe que esta tarea resuelve al terminarla. */
    unlocks: z.string().min(1).optional(),
    /** Cómo valida el usuario lo que haga la IA: borrador a borrador o todos a la vez. */
    validation: z.enum(VALIDATION_MODES),
    origin: z.enum(TASK_ORIGINS),
    milestone: z.enum(MILESTONES).optional(),
    /** Entra si el nivel de validación elegido es >= este. */
    validationLevel: level.optional(),
    /** En fase Lanzar: si supera el nivel de lanzamiento elegido, pasa a Operar. */
    launchLevel: level.optional(),
    /** Ya no aplica según el informe, pero se empezó: visible, fuera del timeline, no bloquea. */
    archived: z.literal("no_longer_needed").optional(),
    steps: z.array(stepSchema).min(1),
  })
  .superRefine((task, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const ids = task.steps.map((step) => step.id);
    if (new Set(ids).size !== ids.length) issue("duplicate step id");
    if (task.dependsOn.includes(task.id)) issue("task depends on itself");
    for (const unknown of unknownDependencies(task.steps)) issue(`unknown step dependency ${unknown}`);
    if (findCycle(task.steps)) issue("step dependency cycle");
  });

export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = "blocked" | "todo" | "doing" | "waiting" | "done";
export interface Range {
  min: number;
  max: number;
}

const ZERO: Range = { min: 0, max: 0 };
const add = (a: Range, b: Range): Range => ({ min: a.min + b.min, max: a.max + b.max });
const larger = (a: Range, b: Range): Range => ({ min: Math.max(a.min, b.min), max: Math.max(a.max, b.max) });

export const isStepResolved = (step: Step) => step.status === "done" || step.status === "skipped";
/** Se ha hecho algo con el paso (saltarlo no cuenta como avanzar). */
const isAdvanced = (step: Step) => step.status !== "todo" && step.status !== "skipped";
export const isTaskResolved = (task: Task) => task.steps.every(isStepResolved);

/** Problemas del grafo de tareas del plan: dependencias a tareas que no existen y ciclos. */
export function taskGraphIssues(tasks: readonly Task[]): string[] {
  const cycle = findCycle(tasks);
  return [...unknownDependencies(tasks), ...(cycle ? [`cycle ${cycle.join(" → ")}`] : [])];
}

/** Tareas de las que depende y que aún no están resueltas. */
export function pendingDependencies(task: Task, tasks: readonly Task[]): string[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return task.dependsOn.filter((id) => {
    const dependency = byId.get(id);
    return dependency !== undefined && dependency.archived === undefined && !isTaskResolved(dependency);
  });
}

/** Pasos de la misma tarea de los que depende y que aún no están resueltos. */
export function pendingStepDependencies(step: Step, task: Task): string[] {
  return (step.dependsOn ?? []).filter((id) => {
    const dependency = task.steps.find((s) => s.id === id);
    return dependency !== undefined && !isStepResolved(dependency);
  });
}

export function taskStatus(task: Task, tasks: readonly Task[]): TaskStatus {
  if (isTaskResolved(task)) return "done";
  if (!task.steps.some(isAdvanced)) return pendingDependencies(task, tasks).length > 0 ? "blocked" : "todo";
  const remaining = task.steps.filter((step) => !isStepResolved(step));
  // Solo esperas cuando todo lo que queda está pedido a un tercero; "recibido" ya pide algo de ti.
  return remaining.every((step) => step.status === "requested") ? "waiting" : "doing";
}

/** Bloqueo blando: se avanzó aunque una dependencia no estaba resuelta. */
export function taskOutOfOrder(task: Task, tasks: readonly Task[]) {
  return task.steps.some(isAdvanced) && pendingDependencies(task, tasks).length > 0;
}

export function stepOutOfOrder(step: Step, task: Task) {
  return isAdvanced(step) && pendingStepDependencies(step, task).length > 0;
}

/**
 * Totales de la tarea (sin contar pasos saltados), siempre estimados porque vienen del catálogo:
 * esfuerzo y coste se suman; la espera es la cadena más larga de esperas según las dependencias.
 */
export function taskTotals(task: Task): { effort: Range; wait: Range; cost: Range } {
  const active = task.steps.filter((step) => step.status !== "skipped");
  const byId = new Map(active.map((step) => [step.id, step]));
  const finish = new Map<string, Range>();

  const waitUntilDone = (step: Step): Range => {
    const cached = finish.get(step.id);
    if (cached) return cached;
    const before = (step.dependsOn ?? [])
      .map((id) => byId.get(id))
      .filter((dependency) => dependency !== undefined)
      .map(waitUntilDone)
      .reduce(larger, ZERO);
    const result = add(before, step.wait ?? ZERO);
    finish.set(step.id, result);
    return result;
  };

  return {
    effort: active.reduce((sum, step) => add(sum, step.effort), ZERO),
    wait: active.map(waitUntilDone).reduce(larger, ZERO),
    cost: active.reduce((sum, step) => (step.cost ? add(sum, step.cost) : sum), ZERO),
  };
}