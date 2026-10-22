import type { Department } from "./line.ts";
import type { PlanTaskView, PlanView } from "./view.ts";

/**
 * Cronograma del plan agrupado por departamento (plegable, como la vista Fases). Columnas por semana;
 * cada barra tiene un tramo seguro (inicio → fin mínimo) y una cola estimada (fin mínimo → fin máximo).
 * Solo calcula posiciones; lo dibuja el componente.
 */

export const TIMELINE = { left: 240, weekWidth: 44, top: 64, bottom: 44 } as const;
export const TIMELINE_GROUPS = { deptHeight: 36, objectiveHeight: 26, taskHeight: 30 } as const;
/** Más de este hueco sin tareas parte la barra de un departamento en dos tramos. */
export const GAP_DAYS = 14;

const DAY = 86_400_000;

/** Días entre dos fechas ISO (yyyy-mm-dd). */
function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

type Bar = { x1: number; xMin: number; xMax: number };

export type GroupedRow =
  | {
      kind: "department";
      key: string;
      department: Department;
      y: number;
      open: boolean;
      objectives: number;
      done: number;
      total: number;
      /** Tramos de trabajo pendiente (vacío si no queda nada). */
      segments: Bar[];
      /** Pasos resueltos sobre el total de pasos de sus tareas pendientes. */
      progress: number;
    }
  | { kind: "objective"; key: string; department: Department; line: number; goal: string; y: number }
  | ({ kind: "task"; key: string; id: string; department: Department; y: number; task: PlanTaskView } & Bar);

export interface GroupedTimeline {
  width: number;
  height: number;
  weeks: { index: number; x: number }[];
  rows: GroupedRow[];
  opening: { x1: number; x2: number } | null;
  todayX: number | null;
  /** Dependencias entre lo visible (tramos de departamentos plegados o tareas de los abiertos). */
  edges: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[];
}

export function timelineGroups(view: PlanView, today: string, expanded: ReadonlySet<Department> = new Set()): GroupedTimeline {
  const { left, weekWidth, top, bottom } = TIMELINE;
  const { deptHeight, objectiveHeight, taskHeight } = TIMELINE_GROUPS;
  const xOfDay = (day: number) => left + (day / 7) * weekWidth;
  const pending = view.phases.flatMap((group) => group.tasks);
  const all = view.phases.flatMap((group) => [...group.tasks, ...group.done]);
  const departmentOf = (line: number) => view.lines[line]?.department;

  const rows: GroupedRow[] = [];
  /** Dónde se ve cada tarea pendiente: su fila propia o el tramo de su departamento. */
  const anchorOf = new Map<string, { row: string; start: number; end: number; y: number }>();
  let y = top;

  for (const department of [...new Set(view.lines.map((line) => line.department))]) {
    const own = pending.filter((t) => departmentOf(t.line) === department).sort((a, b) => a.schedule.start - b.schedule.start);
    const ownAll = all.filter((t) => departmentOf(t.line) === department);
    const lines = view.lines.flatMap((line, index) => (line.department === department ? [index] : []));
    const open = expanded.has(department);
    const key = `d:${department}`;

    // Tramos: tareas seguidas (sin un hueco de más de GAP_DAYS) forman uno.
    const segments: (Bar & { ids: string[] })[] = [];
    for (const task of own) {
      const last = segments.at(-1);
      const lastEndDay = last ? ((last.xMax - left) / weekWidth) * 7 : -Infinity;
      if (last && task.schedule.start <= lastEndDay + GAP_DAYS) {
        last.xMin = Math.max(last.xMin, xOfDay(task.schedule.endMin));
        last.xMax = Math.max(last.xMax, xOfDay(task.schedule.endMax));
        last.ids.push(task.id);
      } else {
        segments.push({ x1: xOfDay(task.schedule.start), xMin: xOfDay(task.schedule.endMin), xMax: xOfDay(task.schedule.endMax), ids: [task.id] });
      }
    }
    const steps = own.reduce((sum, t) => sum + t.progress.total, 0);
    const resolved = own.reduce((sum, t) => sum + t.progress.done, 0);

    rows.push({
      kind: "department",
      key,
      department,
      y,
      open,
      objectives: lines.length,
      done: ownAll.filter((t) => t.status === "done").length,
      total: ownAll.length,
      segments: segments.map(({ x1, xMin, xMax }) => ({ x1, xMin, xMax })),
      progress: steps === 0 ? 0 : resolved / steps,
    });
    if (!open) {
      for (const segment of segments) {
        for (const id of segment.ids) anchorOf.set(id, { row: key, start: segment.x1, end: segment.xMin, y });
      }
    }
    y += deptHeight;
    if (!open) continue;

    for (const line of lines) {
      const lineTasks = own.filter((t) => t.line === line);
      if (lineTasks.length === 0) continue;
      rows.push({ kind: "objective", key: `o:${line}`, department, line, goal: view.lines[line].goal, y });
      y += objectiveHeight;
      for (const task of lineTasks) {
        const bar = { x1: xOfDay(task.schedule.start), xMin: xOfDay(task.schedule.endMin), xMax: xOfDay(task.schedule.endMax) };
        const rowKey = `t:${task.id}`;
        rows.push({ kind: "task", key: rowKey, id: task.id, department, y, task, ...bar });
        anchorOf.set(task.id, { row: rowKey, start: bar.x1, end: bar.xMin, y });
        y += taskHeight;
      }
    }
  }

  const lastDay = Math.max(0, ...pending.map((task) => task.schedule.endMax));
  const totalWeeks = Math.max(1, Math.ceil(lastDay / 7), view.opening?.weeks.to ?? 0);
  const weeks = Array.from({ length: totalWeeks }, (_, index) => ({ index: index + 1, x: left + index * weekWidth }));
  const todayDay = daysBetween(view.form.startDate, today);
  const todayX = todayDay >= 0 && todayDay <= totalWeeks * 7 ? xOfDay(todayDay) : null;
  const opening = view.opening
    ? { x1: left + (view.opening.weeks.from - 1) * weekWidth, x2: left + view.opening.weeks.to * weekWidth }
    : null;

  const seen = new Set<string>();
  const edges: GroupedTimeline["edges"] = [];
  for (const task of pending) {
    const to = anchorOf.get(task.id);
    for (const dependency of task.dependsOn) {
      const from = anchorOf.get(dependency);
      if (!from || !to || from.row === to.row) continue;
      const key = `${from.row}@${from.end}>${to.row}@${to.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: from.row, to: to.row, x1: from.end, y1: from.y, x2: to.start, y2: to.y });
    }
  }

  return { width: left + totalWeeks * weekWidth + 24, height: y + bottom, weeks, rows, opening, todayX, edges };
}