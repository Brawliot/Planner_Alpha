import type { Department } from "./line.ts";
import type { TaskStatus } from "./task.ts";
import type { PlanView } from "./view.ts";

/**
 * Mapa de metro del plan (vista Fases): columnas = fases; una fila por departamento que se puede
 * desplegar en sus objetivos (líneas de trabajo). Las estaciones agrupan las tareas de una fila en
 * una fase. Solo calcula posiciones y textos; lo dibuja el componente.
 */

export const METRO = { left: 230, colWidth: 210, top: 84, deptHeight: 58, lineHeight: 44, bottom: 24 } as const;

type Phase = PlanView["phases"][number]["phase"];
type StationTask = { id: string; title: string; status: TaskStatus };

export type MetroRow =
  | { kind: "department"; key: string; department: Department; y: number; lines: number[]; done: number; total: number; open: boolean }
  | { kind: "line"; key: string; department: Department; line: number; goal: string; y: number };

export interface MetroStation {
  key: string;
  /** Fila a la que pertenece (departamento plegado u objetivo). */
  row: string;
  department: Department;
  line: number | null;
  phase: Phase;
  x: number;
  y: number;
  tasks: StationTask[];
  lead: { id: string; title: string };
  extra: number;
}

export interface MetroTrack {
  row: string;
  department: Department;
  y: number;
  x1: number;
  x2: number;
  reachedX: number | null;
  /** Departamento desplegado: vía fina con puntos en las fases (el detalle va en sus objetivos). */
  thin: boolean;
  stops: number[];
}

export interface MetroLayout {
  width: number;
  height: number;
  columns: { phase: Phase; x: number; done: number; total: number; started: boolean }[];
  rows: MetroRow[];
  tracks: MetroTrack[];
  stations: MetroStation[];
  /** Dependencias entre estaciones visibles de filas distintas. */
  edges: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[];
}

const STARTED: readonly TaskStatus[] = ["doing", "waiting", "done"];

/** Doing > waiting > la primera sin hacer > la primera. */
function leadOf(tasks: readonly StationTask[]) {
  return (
    tasks.find((t) => t.status === "doing") ??
    tasks.find((t) => t.status === "waiting") ??
    tasks.find((t) => t.status !== "done") ??
    tasks[0]
  );
}

export function metroLayout(view: PlanView, expanded: ReadonlySet<Department> = new Set()): MetroLayout {
  const { left, colWidth, top, deptHeight, lineHeight, bottom } = METRO;
  const groups = view.phases;
  const xOf = (phaseIndex: number) => left + phaseIndex * colWidth;
  const all = groups.flatMap((group, phaseIndex) => [...group.tasks, ...group.done].map((task) => ({ ...task, phaseIndex })));
  const departmentOf = (line: number) => view.lines[line]?.department;

  const columns = groups.map((group, i) => {
    const tasks = [...group.tasks, ...group.done];
    return { phase: group.phase, x: xOf(i), done: group.done.length, total: tasks.length, started: tasks.some((t) => STARTED.includes(t.status)) };
  });

  const rows: MetroRow[] = [];
  const tracks: MetroTrack[] = [];
  const stations: MetroStation[] = [];

  const place = (row: string, department: Department, line: number | null, y: number, rowTasks: typeof all, withStations: boolean, thin: boolean) => {
    const phases = [...new Set(rowTasks.map((t) => t.phaseIndex))].sort((a, b) => a - b);
    if (phases.length === 0) return;
    const started = phases.filter((p) => rowTasks.some((t) => t.phaseIndex === p && STARTED.includes(t.status)));
    tracks.push({
      row,
      department,
      y,
      x1: xOf(phases[0]),
      x2: xOf(phases.at(-1)!),
      reachedX: started.length > 0 ? xOf(started.at(-1)!) : null,
      thin,
      stops: thin ? phases.map(xOf) : [],
    });
    if (!withStations) return;
    for (const p of phases) {
      const tasks = rowTasks.filter((t) => t.phaseIndex === p).map((t) => ({ id: t.id, title: t.title, status: t.status }));
      const lead = leadOf(tasks);
      stations.push({
        key: `${row}|${groups[p].phase}`,
        row,
        department,
        line,
        phase: groups[p].phase,
        x: xOf(p),
        y,
        tasks,
        lead: { id: lead.id, title: lead.title },
        extra: tasks.length - 1,
      });
    }
  };

  let y = top;
  for (const department of [...new Set(view.lines.map((line) => line.department))]) {
    const lines = view.lines.flatMap((line, index) => (line.department === department ? [index] : []));
    const tasks = all.filter((t) => departmentOf(t.line) === department);
    const open = expanded.has(department);
    const key = `d:${department}`;
    rows.push({ kind: "department", key, department, y, lines, done: tasks.filter((t) => t.status === "done").length, total: tasks.length, open });
    place(key, department, null, y, tasks, !open, open);
    y += deptHeight;
    if (!open) continue;
    for (const line of lines) {
      const lineKey = `l:${line}`;
      rows.push({ kind: "line", key: lineKey, department, line, goal: view.lines[line].goal, y });
      place(lineKey, department, line, y, all.filter((t) => t.line === line), true, false);
      y += lineHeight;
    }
  }

  const stationOf = new Map(stations.flatMap((s) => s.tasks.map((t) => [t.id, s] as const)));
  const seen = new Set<string>();
  const edges: MetroLayout["edges"] = [];
  for (const task of all) {
    const to = stationOf.get(task.id);
    for (const dependency of task.dependsOn) {
      const from = stationOf.get(dependency);
      if (!from || !to || from.row === to.row) continue;
      const key = `${from.key}>${to.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: from.key, to: to.key, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
  }

  return { width: left + Math.max(groups.length, 1) * colWidth, height: y + bottom, columns, rows, tracks, stations, edges };
}