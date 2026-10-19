import { isTaskProtected } from "./merge.ts";
import type { Task } from "./task.ts";

/**
 * Tareas generadas por la IA a partir de un molde ("Generar"). Ocupan el sitio de la tarea del molde:
 * su posición, línea, fase y dependencias (las decide siempre el código), y quien esperaba al molde
 * espera a todas ellas. Se mantienen mientras su molde siga en el plan; si se quitan todas, vuelve el molde.
 */

/** "Generar" solo sobre una tarea del catálogo que sale de un molde y está sin tocar. */
export function canGenerate(task: Task) {
  return task.origin === "catalog" && task.mold !== undefined && !isTaskProtected(task);
}

export function applyConcretions(
  skeleton: readonly Task[],
  stored: readonly Task[],
  dismissed: ReadonlySet<string>,
): Task[] {
  const byMold = new Map<string, Task[]>();
  for (const task of stored) {
    if (task.origin !== "ai" || task.mold === undefined || task.archived !== undefined || dismissed.has(task.id)) continue;
    byMold.set(task.mold, [...(byMold.get(task.mold) ?? []), task]);
  }

  /** Tarea del molde → ids de sus generadas. */
  const replaced = new Map<string, string[]>();
  for (const task of skeleton) {
    const generated = byMold.get(task.id);
    if (task.mold === task.id && generated) replaced.set(task.id, generated.map((g) => g.id));
  }
  const rewrite = (dependsOn: readonly string[]) => [...new Set(dependsOn.flatMap((id) => replaced.get(id) ?? [id]))];

  return skeleton.flatMap((task): Task[] => {
    if (!replaced.has(task.id)) return [{ ...task, dependsOn: rewrite(task.dependsOn) }];
    const generated = byMold.get(task.id)!;
    const siblings = new Set(generated.map((g) => g.id));
    const external = rewrite(task.dependsOn);
    return generated.map((g) => ({
      ...g,
      lineId: task.lineId,
      phase: task.phase,
      // Las de fuera, siempre las del molde ahora; entre ellas, las que guardaron al generarse.
      dependsOn: [...new Set([...external, ...g.dependsOn.filter((id) => siblings.has(id))])],
    }));
  });
}