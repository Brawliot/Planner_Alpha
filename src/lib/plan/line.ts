import { z } from "zod";
import { AREA_KEYS } from "../report/areas.ts";
import { isTaskResolved, type Task } from "./task.ts";

/**
 * Línea de trabajo: agrupa las tareas que resuelven una cosa concreta del informe y les da un objetivo.
 * No guarda sus tareas (cada tarea apunta a su línea) ni su estado: se derivan siempre.
 * Los verdes no generan líneas: son fortalezas y contexto.
 */

/** Fijos para todo negocio; en pantalla solo aparecen los que tienen líneas. */
export const DEPARTMENTS = ["founder", "product", "sales", "finance", "legal", "operations", "team"] as const;
export type Department = (typeof DEPARTMENTS)[number];

const area = z.enum(AREA_KEYS);
const keys = z.array(z.string().min(1)).min(1);

export const lineSourceSchema = z.discriminatedUnion("kind", [
  /** Un rojo del informe: hecho con efecto negativo, línea de trabajo. */
  z.object({ kind: z.literal("risk"), area, reason: z.string().min(1) }),
  /** Un gris: falta lo imprescindible para dar color. */
  z.object({ kind: z.literal("needs_info"), area, keys }),
  /** Lo "por concretar" de un área. */
  z.object({ kind: z.literal("gaps"), area, keys }),
  /** Datos estimados que conviene comprobar. */
  z.object({ kind: z.literal("estimated"), area, keys }),
  /** Lo que todo negocio necesita aunque el informe no lo marque. */
  z.object({ kind: z.literal("base") }),
]);

export const lineSchema = z.object({
  id: z.string().min(1),
  department: z.enum(DEPARTMENTS),
  source: lineSourceSchema,
  goal: z.string().min(1),
  /** Cómo se elige resolverla; dónde se elige se decide con la configuración del entorno. */
  lever: z.string().min(1).optional(),
});

export type Line = z.infer<typeof lineSchema>;
export type LineSource = z.infer<typeof lineSourceSchema>;

export function tasksOf(line: Line, tasks: readonly Task[]) {
  return tasks.filter((task) => task.lineId === line.id);
}

/** Progreso de la línea: tareas resueltas (hechas o saltadas) sobre el total. */
export function lineProgress(line: Line, tasks: readonly Task[]) {
  const own = tasksOf(line, tasks);
  const resolved = own.filter(isTaskResolved).length;
  return { resolved, total: own.length, done: own.length > 0 && resolved === own.length };
}

/** Departamentos con alguna línea, en el orden fijo de DEPARTMENTS. */
export function activeDepartments(lines: readonly Line[]): Department[] {
  const used = new Set(lines.map((line) => line.department));
  return DEPARTMENTS.filter((department) => used.has(department));
}

/** Problemas entre líneas y tareas: ids repetidos, tareas sin línea y líneas sin tareas. */
export function lineIssues(lines: readonly Line[], tasks: readonly Task[]): string[] {
  const ids = lines.map((line) => line.id);
  const issues: string[] = [];
  for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) issues.push(`duplicate line ${id}`);
  for (const task of tasks) if (!ids.includes(task.lineId)) issues.push(`task ${task.id} has unknown line ${task.lineId}`);
  for (const line of lines) if (tasksOf(line, tasks).length === 0) issues.push(`line ${line.id} has no tasks`);
  return issues;
}