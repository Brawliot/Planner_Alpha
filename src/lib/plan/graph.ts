/** Dependencias entre tareas o entre pasos: solo "B empieza cuando A termina". */

export interface DependencyNode {
  id: string;
  dependsOn?: readonly string[];
}

/** Devuelve un ciclo (ids en orden, cerrando en el primero) o null. Los ids inexistentes se ignoran aquí. */
export function findCycle(nodes: readonly DependencyNode[]): string[] | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];

  const visit = (id: string): string[] | null => {
    const current = state.get(id);
    if (current === "done") return null;
    if (current === "visiting") return [...path.slice(path.indexOf(id)), id];
    state.set(id, "visiting");
    path.push(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      if (!byId.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(id, "done");
    return null;
  };

  for (const node of nodes) {
    const cycle = visit(node.id);
    if (cycle) return cycle;
  }
  return null;
}

/** Dependencias que apuntan a ids que no existen, como "a → b". */
export function unknownDependencies(nodes: readonly DependencyNode[]): string[] {
  const ids = new Set(nodes.map((node) => node.id));
  return nodes.flatMap((node) =>
    (node.dependsOn ?? []).filter((dependency) => !ids.has(dependency)).map((dependency) => `${node.id} → ${dependency}`),
  );
}