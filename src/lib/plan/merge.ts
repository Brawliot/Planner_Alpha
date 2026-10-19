import type { Step } from "./step.ts";
import type { Task } from "./task.ts";

/**
 * Actualizar el plan sin pisar lo del usuario. Protegido = lo que el usuario ha tocado.
 * - Tarea nueva: entra (salvo que el usuario la descartara).
 * - Tarea que sigue: protegida conserva lo suyo (pasos, textos), pero su sitio en el plan (línea, fase,
 *   dependencias) lo decide siempre el código; si no está protegida, se rehace con lo nuevo.
 * - Tarea que ya no aplica: protegida se archiva; si no, se quita. También las sugeridas por IA, que
 *   entran como tareas normales mientras su molde siga en el plan (concretion.ts).
 */

export function isStepProtected(step: Step) {
  return step.status !== "todo" || step.actorSetBy === "user" || Boolean(step.note) || Boolean(step.artifact);
}

export function isTaskProtected(task: Task) {
  return task.steps.some(isStepProtected);
}

export function mergeTasks(current: readonly Task[], fresh: readonly Task[], dismissed: ReadonlySet<string>): Task[] {
  const freshIds = new Set(fresh.map((task) => task.id));
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
      if (!existing || !isTaskProtected(existing)) return task;
      return { ...unarchived(existing), lineId: task.lineId, phase: task.phase, dependsOn: task.dependsOn };
    });

  const leftovers = current
    .filter((task) => !freshIds.has(task.id) && !dismissed.has(task.id))
    .flatMap((task): Task[] => (isTaskProtected(task) ? [{ ...task, archived: "no_longer_needed" }] : []));

  return [...updated, ...leftovers];
}