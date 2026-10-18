import { usable } from "../report/areas.ts";
import type { Fact } from "../report/facts.ts";
import type { Task } from "./task.ts";

/**
 * Certeza de una tarea según los datos del informe en que se apoya (basis):
 * - unknown: alguno no se sabe (no debería pasar: lo no sabido va en unlocks, no en basis);
 * - estimated: alguno es estimado;
 * - known: todos son sabidos, o no se apoya en ninguno (tareas base).
 * Las cifras del plan (esfuerzo, coste, espera) son siempre estimadas y se marcan aparte.
 */
export type TaskCertainty = "known" | "estimated" | "unknown";

export function taskCertainty(task: Task, facts: readonly Fact[]): TaskCertainty {
  const inputs = task.basis.map((key) => usable(facts, key));
  if (inputs.some((input) => input === null)) return "unknown";
  return inputs.some((input) => input?.certainty === "estimated") ? "estimated" : "known";
}