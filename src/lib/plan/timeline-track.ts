import { areaSignals, type AreaSignal } from "./areas-tree.ts";
import type { Department } from "./line.ts";
import type { TaskStatus } from "./task.ts";
import type { PlanView } from "./view.ts";

/**
 * Cronograma por departamento en una ventana de semanas (las próximas 12 o todo el plan). Todo va en
 * semanas desde el inicio del plan (0 = inicio de la semana 1): el componente lo pasa a píxeles según
 * el ancho disponible. Cada barra tiene un tramo probable (inicio → fin mínimo) y una cola hasta el
 * peor caso (fin máximo), recortados a la ventana.
 */

export const TRACK = {
  nextWeeks: 12,
  /** Más de este hueco sin tareas parte la barra de un departamento en dos tramos. */
  gapDays: 14,
} as const;

export type TrackRange = "next" | "all";

export interface TrackBar {
  start: number;
  endMin: number;
  endMax: number;
  /** Semana (1, 2…) en la que acaba de verdad si se sale por la derecha de la ventana; null si cabe. */
  beyond: number | null;
}

export type TrackRow =
  | {
      kind: "department";
      key: string;
      department: Department;
      open: boolean;
      objectives: number;
      done: number;
      total: number;
      signal: AreaSignal;
      /** Tramos de trabajo pendiente dentro de la ventana. */
      segments: TrackBar[];
      /** Si todo su trabajo empieza después de la ventana, la semana (1, 2…) en que empieza. */
      startsAt: number | null;
    }
  | { kind: "objective"; key: string; department: Department; line: number; goal: string }
  | {
      kind: "task";
      key: string;
      id: string;
      title: string;
      department: Department;
      status: TaskStatus;
      now: boolean;
      /** null si queda fuera de la ventana. */
      bar: TrackBar | null;
      startsAt: number | null;
    };

export interface TimelineTrack {
  /** Ventana visible: semanas [from, to). */
  from: number;
  to: number;
  /** Cambios de mes dentro de la ventana: semana en que empieza y nombre corto. */
  months: { week: number; label: string }[];
  rows: TrackRow[];
  /** Hoy, en semanas, si cae dentro de la ventana. */
  today: number | null;
  /** Rango de apertura recortado a la ventana; cut indica que sigue más allá. */
  opening: { start: number; end: number; cut: boolean } | null;
}

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function timelineTrack(view: PlanView, today: string, expanded: ReadonlySet<Department> = new Set(), range: TrackRange = "next"): TimelineTrack {
  const pending = view.phases.flatMap((group) => group.tasks);
  const all = view.phases.flatMap((group) => [...group.tasks, ...group.done]);
  const departmentOf = (line: number) => view.lines[line]?.department;
  const nowIds = new Set(view.now.map((item) => item.taskId));
  const signalOf = new Map(areaSignals(view).map((s) => [s.department, s]));

  // Ventana: todo el plan, o 12 semanas desde la semana de hoy (o desde el inicio, si aún no ha empezado).
  const lastDay = Math.max(0, ...pending.map((task) => task.schedule.endMax));
  const totalWeeks = Math.max(1, Math.ceil(lastDay / 7), view.opening?.weeks.to ?? 0);
  const todayDays = Math.round((dayOf(today) - dayOf(view.form.startDate)) / DAY);
  const from = range === "all" ? 0 : Math.max(0, Math.floor(todayDays / 7));
  const to = range === "all" ? totalWeeks : from + TRACK.nextWeeks;

  const clip = (startDay: number, endMinDay: number, endMaxDay: number): TrackBar | null => {
    const [start, endMin, endMax] = [startDay / 7, endMinDay / 7, endMaxDay / 7];
    if (start >= to || endMax <= from) return null;
    const inside = (w: number) => Math.min(Math.max(w, from), to);
    return { start: inside(start), endMin: inside(endMin), endMax: inside(endMax), beyond: endMax > to ? Math.ceil(endMax) : null };
  };
  const startsAfter = (startDay: number) => (startDay / 7 >= to ? Math.floor(startDay / 7) + 1 : null);

  const rows: TrackRow[] = [];
  for (const department of [...new Set(view.lines.map((line) => line.department))]) {
    const own = pending.filter((t) => departmentOf(t.line) === department).sort((a, b) => a.schedule.start - b.schedule.start);
    const lines = view.lines.flatMap((line, index) => (line.department === department ? [index] : []));
    const open = expanded.has(department);

    // Tramos en días: tareas seguidas (sin un hueco de más de gapDays) forman uno.
    const spans: { start: number; endMin: number; endMax: number }[] = [];
    for (const task of own) {
      const last = spans.at(-1);
      if (last && task.schedule.start <= last.endMax + TRACK.gapDays) {
        last.endMin = Math.max(last.endMin, task.schedule.endMin);
        last.endMax = Math.max(last.endMax, task.schedule.endMax);
      } else {
        spans.push({ ...task.schedule });
      }
    }
    const segments = spans.flatMap((s) => clip(s.start, s.endMin, s.endMax) ?? []);

    rows.push({
      kind: "department",
      key: `d:${department}`,
      department,
      open,
      objectives: lines.length,
      done: all.filter((t) => departmentOf(t.line) === department && t.status === "done").length,
      total: all.filter((t) => departmentOf(t.line) === department).length,
      signal: signalOf.get(department)!,
      segments,
      startsAt: segments.length === 0 && own.length > 0 ? startsAfter(own[0].schedule.start) : null,
    });
    if (!open) continue;

    for (const line of lines) {
      const lineTasks = own.filter((t) => t.line === line);
      if (lineTasks.length === 0) continue;
      rows.push({ kind: "objective", key: `o:${line}`, department, line, goal: view.lines[line].goal });
      for (const task of lineTasks) {
        rows.push({
          kind: "task",
          key: `t:${task.id}`,
          id: task.id,
          title: task.title,
          department,
          status: task.status,
          now: nowIds.has(task.id),
          bar: clip(task.schedule.start, task.schedule.endMin, task.schedule.endMax),
          startsAt: startsAfter(task.schedule.start),
        });
      }
    }
  }

  // Meses: uno cada vez que cambia el mes de la semana; el año en el primero y en cada enero.
  const monthName = new Intl.DateTimeFormat(view.language, { month: "short", timeZone: "UTC" });
  const months: TimelineTrack["months"] = [];
  let previous = -1;
  for (let week = from; week < to; week++) {
    const date = new Date(dayOf(view.form.startDate) + week * 7 * DAY);
    const month = date.getUTCMonth();
    if (month === previous) continue;
    const name = monthName.format(date).replace(".", "");
    months.push({ week, label: months.length === 0 || month === 0 ? `${name} ${date.getUTCFullYear()}` : name });
    previous = month;
  }

  const todayWeek = todayDays / 7;
  const opening = view.opening
    ? (() => {
        const start = view.opening.weeks.from - 1;
        const end = view.opening.weeks.to;
        if (start >= to || end <= from) return null;
        return { start: Math.max(start, from), end: Math.min(end, to), cut: end > to };
      })()
    : null;

  return { from, to, months, rows, today: todayWeek >= from && todayWeek <= to ? todayWeek : null, opening };
}