import type { Department } from "./line.ts";
import type { PlanTaskView, PlanView } from "./view.ts";

/**
 * Cronograma del plan: filas por departamento (cabecera + sus tareas pendientes por orden de inicio),
 * columnas por semana. Cada barra tiene un tramo seguro (inicio → fin mínimo) y una cola estimada
 * (fin mínimo → fin máximo). Solo calcula posiciones; lo dibuja el componente.
 */

export const TIMELINE = { left: 240, weekWidth: 44, top: 64, rowHeight: 30, bottom: 44 } as const;

export type TimelineRow =
  | { kind: "department"; department: Department; y: number }
  | {
      kind: "task";
      id: string;
      y: number;
      x1: number;
      xMin: number;
      xMax: number;
      task: PlanTaskView;
    };

export interface TimelineLayout {
  width: number;
  height: number;
  weeks: { index: number; x: number }[];
  rows: TimelineRow[];
  /** Banda de apertura (semanas mínima y máxima); null si no hay fecha de apertura. */
  opening: { x1: number; x2: number } | null;
  /** Posición de hoy; null si cae fuera del plan. */
  todayX: number | null;
  edges: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[];
}

const DAY = 86_400_000;

/** Días entre dos fechas ISO (yyyy-mm-dd). */
function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

export function timelineLayout(view: PlanView, today: string): TimelineLayout {
  const { left, weekWidth, top, rowHeight, bottom } = TIMELINE;
  const xOfDay = (day: number) => left + (day / 7) * weekWidth;
  const pending = view.phases.flatMap((group) => group.tasks);

  // Orden de departamentos: el de las líneas del plan.
  const departments = [...new Set(view.lines.map((line) => line.department))];
  const rows: TimelineRow[] = [];
  let y = top;
  for (const department of departments) {
    const tasks = pending
      .filter((task) => task.department === department)
      .sort((a, b) => a.schedule.start - b.schedule.start);
    if (tasks.length === 0) continue;
    rows.push({ kind: "department", department, y });
    y += rowHeight;
    for (const task of tasks) {
      rows.push({
        kind: "task",
        id: task.id,
        y,
        x1: xOfDay(task.schedule.start),
        xMin: xOfDay(task.schedule.endMin),
        xMax: xOfDay(task.schedule.endMax),
        task,
      });
      y += rowHeight;
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

  const taskRows = new Map(rows.flatMap((row) => (row.kind === "task" ? [[row.id, row] as const] : [])));
  const edges: TimelineLayout["edges"] = [];
  for (const row of taskRows.values()) {
    for (const dependency of row.task.dependsOn) {
      const from = taskRows.get(dependency);
      if (!from) continue;
      edges.push({ from: from.id, to: row.id, x1: from.xMin, y1: from.y, x2: row.x1, y2: row.y });
    }
  }

  return {
    width: left + totalWeeks * weekWidth + 24,
    height: y + bottom,
    weeks,
    rows,
    opening,
    todayX,
    edges,
  };
}