import type { TaskStatus } from "./task.ts";
import type { DoneTaskView, PlanView } from "./view.ts";

/**
 * Mapa de metro del plan (vista Fases): columnas = fases, filas = líneas de trabajo,
 * estaciones = tareas de una línea en una fase (agrupadas si hay varias). Solo calcula
 * posiciones y textos; lo dibuja el componente.
 */

export const METRO = { left: 190, colWidth: 210, top: 96, rowHeight: 56, bottom: 36 } as const;

type Phase = PlanView["phases"][number]["phase"];

export interface MetroStation {
  key: string;
  /** Posición de la línea en PlanView.lines. */
  line: number;
  phase: Phase;
  x: number;
  y: number;
  /** Tareas de la estación, en orden, con su estado (un segmento por tarea si hay varias). */
  tasks: { id: string; title: string; status: TaskStatus }[];
  /** La tarea que da nombre a la estación (la que más importa ahora). */
  lead: { id: string; title: string };
  /** Cuántas más hay además de la principal ("+N"). */
  extra: number;
}

export interface MetroLayout {
  width: number;
  height: number;
  columns: { phase: Phase; x: number; done: number; total: number; started: boolean }[];
  rows: { line: number; y: number }[];
  /** Vía de cada línea: de su primera a su última estación; reachedX = hasta dónde se ha avanzado. */
  tracks: { line: number; y: number; x1: number; x2: number; reachedX: number | null }[];
  stations: MetroStation[];
  /** Dependencias entre líneas distintas (de la estación de la que se depende a la que depende). */
  edges: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[];
}

const STARTED: readonly TaskStatus[] = ["doing", "waiting", "done"];

/** Doing > waiting > la primera sin hacer > la primera. */
function leadOf(tasks: readonly MetroStation["tasks"][number][]) {
  return (
    tasks.find((t) => t.status === "doing") ??
    tasks.find((t) => t.status === "waiting") ??
    tasks.find((t) => t.status !== "done") ??
    tasks[0]
  );
}

export function metroLayout(view: PlanView): MetroLayout {
  const { left, colWidth, top, rowHeight, bottom } = METRO;
  const groups = view.phases;
  const all: (DoneTaskView & { phaseIndex: number })[] = groups.flatMap((group, phaseIndex) =>
    [...group.tasks, ...group.done].map((task) => ({ ...task, phaseIndex })),
  );

  const columns = groups.map((group, i) => {
    const tasks = [...group.tasks, ...group.done];
    return {
      phase: group.phase,
      x: left + i * colWidth,
      done: group.done.length,
      total: tasks.length,
      started: tasks.some((t) => STARTED.includes(t.status)),
    };
  });

  const rows = view.lines.map((_, line) => ({ line, y: top + line * rowHeight }));

  const stations: MetroStation[] = [];
  for (const row of rows) {
    for (const [phaseIndex, group] of groups.entries()) {
      const tasks = all
        .filter((t) => t.line === row.line && t.phaseIndex === phaseIndex)
        .map((t) => ({ id: t.id, title: t.title, status: t.status }));
      if (tasks.length === 0) continue;
      const lead = leadOf(tasks);
      stations.push({
        key: `${row.line}|${group.phase}`,
        line: row.line,
        phase: group.phase,
        x: left + phaseIndex * colWidth,
        y: row.y,
        tasks,
        lead: { id: lead.id, title: lead.title },
        extra: tasks.length - 1,
      });
    }
  }

  const tracks = rows.flatMap((row) => {
    const own = stations.filter((s) => s.line === row.line);
    if (own.length === 0) return [];
    const reached = own.filter((s) => s.tasks.some((t) => STARTED.includes(t.status)));
    return [{ line: row.line, y: row.y, x1: own[0].x, x2: own.at(-1)!.x, reachedX: reached.at(-1)?.x ?? null }];
  });

  const stationOf = new Map(stations.flatMap((s) => s.tasks.map((t) => [t.id, s] as const)));
  const seen = new Set<string>();
  const edges: MetroLayout["edges"] = [];
  for (const task of all) {
    const to = stationOf.get(task.id);
    for (const dependency of task.dependsOn) {
      const from = stationOf.get(dependency);
      if (!from || !to || from.line === to.line) continue;
      const key = `${from.key}>${to.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: from.key, to: to.key, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
  }

  return {
    width: left + Math.max(groups.length, 1) * colWidth,
    height: top + Math.max(rows.length - 1, 0) * rowHeight + bottom + rowHeight / 2,
    columns,
    rows,
    tracks,
    stations,
    edges,
  };
}