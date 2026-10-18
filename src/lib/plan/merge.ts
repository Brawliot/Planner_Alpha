import type { Step } from "./step.ts";
import type { Task } from "./task.ts";

/**
 * Actualizar el plan sin pisar lo del usuario. Protegido = lo que el usuario ha tocado.
 * - Tarea nueva: entra (salvo que el usuario la descartara).
 * - Tarea que sigue: protegida se queda tal cual; si no, se rehace con lo nuevo.
 * - Tarea que ya no aplica: protegida se archiva; si no, se quita.
 * - Sugerida por IA: se conserva mientras su línea exista (sustituirla es cosa de "Generar").
 */

export function isStepProtected(step: Step) {
  return step.status !== "todo" || step.actorSetBy === "user" || Boolean(step.note) || Boolean(step.artifact);
}

export function isTaskProtected(task: Task) {
  return task.steps.some(isStepProtected);
}

export function mergeTasks(current: readonly Task[], fresh: readonly Task[], dismissed: ReadonlySet<string>): Task[] {
  const freshIds = new Set(fresh.map((task) => task.id));
  const freshLines = new Set(fresh.map((task) => task.lineId));
  const currentById = new Map(current.map((task) => [task.id, task]));

  const unarchived = (task: Task): Task => {
    const copy = { ...task };
    delete copy.archived;
    return copy;
  };

  const updated = fresh
    .filter((task) => !dismissed.has(task.id))
    .map((task) => {
      const existing = currentById.get(task.id);
      return existing && isTaskProtected(existing) ? unarchived(existing) : task;
    });

  const leftovers = current
    .filter((task) => !freshIds.has(task.id) && !dismissed.has(task.id))
    .flatMap((task): Task[] => {
      if (task.origin === "ai" && freshLines.has(task.lineId)) return [task];
      if (isTaskProtected(task)) return [{ ...task, archived: "no_longer_needed" }];
      return [];
    });

  return [...updated, ...leftovers];
}