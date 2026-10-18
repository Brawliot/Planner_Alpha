import { option } from "../report/verdict.ts";
import { PHASES, isStepResolved, isTaskResolved, taskTotals, type Range, type Task } from "./task.ts";

/**
 * Timeline del plan, calculado siempre en código. Una sola persona trabaja las tareas de una en una,
 * por orden de dependencias, fase y catálogo; las esperas a terceros no consumen sus horas.
 * Se calcula dos veces (rápido: mínimos; lento: máximos) y cada tarea da un rango de días.
 * Lo hecho queda fuera; lo pendiente se planifica desde hoy (o desde el inicio, si aún no ha llegado).
 */

const WEEKLY_HOURS: Record<string, Range> = {
  [option("time_commitment", "Under 10 h/week")]: { min: 5, max: 10 },
  [option("time_commitment", "10-20 h/week")]: { min: 10, max: 20 },
  [option("time_commitment", "20-40 h/week")]: { min: 20, max: 40 },
  [option("time_commitment", "Full time")]: { min: 40, max: 40 },
};

/** Horas por semana según la dedicación del informe; null si no se sabe (lo pregunta la configuración). */
export function weeklyHoursOf(timeCommitment: string | null): Range | null {
  if (timeCommitment === null || !Object.hasOwn(WEEKLY_HOURS, timeCommitment)) return null;
  return { ...WEEKLY_HOURS[timeCommitment] };
}

/** Días desde el inicio del plan. start: empieza a trabajarla; end: termina, espera incluida. */
export interface TaskSchedule {
  taskId: string;
  start: Range;
  end: Range;
}

export interface Timeline {
  tasks: TaskSchedule[];
  /** Fin del plan (días desde el inicio): rápido y lento. */
  end: Range;
}

const DAY_MS = 86_400_000;

/** Días entre dos fechas ISO (YYYY-MM-DD). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + Math.floor(days) * DAY_MS).toISOString().slice(0, 10);
}

/** Semanas (desde 1) que ocupa la tarea, del inicio más temprano al fin más tardío. */
export function weeksOf(schedule: TaskSchedule) {
  const from = Math.floor(schedule.start.min / 7) + 1;
  return { from, to: Math.max(from, Math.ceil(schedule.end.max / 7)) };
}

const remainingOf = (task: Task): Task => ({ ...task, steps: task.steps.filter((step) => !isStepResolved(step)) });

/** Periodo sin disponibilidad en días desde el inicio: [from, to). Ordenados por from. */
interface Blocked {
  from: number;
  to: number;
}

/** Primer momento disponible desde t: si cae en un periodo bloqueado, salta a su fin (en cadena). */
function skipBlocked(t: number, blocked: readonly Blocked[]) {
  let now = t;
  for (const period of blocked) if (now >= period.from && now < period.to) now = period.to;
  return now;
}

/** Fin de un trabajo de `days` días disponibles empezando en t; los periodos bloqueados lo pausan. */
function workUntil(t: number, days: number, blocked: readonly Blocked[]) {
  let now = skipBlocked(t, blocked);
  let left = days;
  for (const period of blocked) {
    if (period.to <= now) continue;
    const span = Math.max(0, period.from - now);
    if (left <= span) return now + left;
    left -= span;
    now = Math.max(now, period.to);
  }
  return now + left;
}

function run(
  tasks: readonly Task[],
  origin: number,
  hoursPerWeek: number,
  pick: "min" | "max",
  blocked: readonly Blocked[],
) {
  const hoursPerDay = hoursPerWeek / 7;
  const ids = new Set(tasks.map((task) => task.id));
  const finish = new Map<string, number>();
  const result = new Map<string, { start: number; end: number }>();
  for (const task of tasks) if (isTaskResolved(task)) finish.set(task.id, origin);

  const priority = (task: Task) => PHASES.indexOf(task.phase) * tasks.length + tasks.indexOf(task);
  const readyAt = (task: Task) =>
    Math.max(origin, ...task.dependsOn.map((id) => finish.get(id) ?? origin));

  const left = tasks.filter((task) => !isTaskResolved(task));
  let free = origin;
  while (left.length > 0) {
    // Candidatas: todas sus dependencias (existentes) ya tienen fecha de fin.
    const candidates = left.filter((task) => task.dependsOn.every((id) => !ids.has(id) || finish.has(id)));
    if (candidates.length === 0) throw new Error("timeline: dependency cycle");
    const now = Math.max(free, Math.min(...candidates.map(readyAt)));
    const task = candidates.filter((t) => readyAt(t) <= now).sort((a, b) => priority(a) - priority(b))[0];

    const totals = taskTotals(remainingOf(task));
    // Tus horas se paran en los periodos sin disponibilidad; la espera al tercero no.
    const start = skipBlocked(now, blocked);
    const workEnd = workUntil(start, totals.effort[pick] / hoursPerDay, blocked);
    const end = workEnd + totals.wait[pick];
    free = workEnd;
    finish.set(task.id, end);
    result.set(task.id, { start, end });
    left.splice(left.indexOf(task), 1);
  }
  return result;
}

export function buildTimeline(input: {
  tasks: readonly Task[];
  startDate: string;
  today: string;
  weeklyHours: Range;
  /** Periodos sin disponibilidad, fechas ISO incluidas. */
  unavailable?: readonly { from: string; to: string }[];
}): Timeline {
  const origin = Math.max(0, daysBetween(input.startDate, input.today));
  const blocked = (input.unavailable ?? [])
    .map((period) => ({
      from: daysBetween(input.startDate, period.from),
      to: daysBetween(input.startDate, period.to) + 1,
    }))
    .sort((a, b) => a.from - b.from);
  const fast = run(input.tasks, origin, input.weeklyHours.max, "min", blocked);
  const slow = run(input.tasks, origin, input.weeklyHours.min, "max", blocked);

  const tasks = [...fast.keys()].map((taskId) => {
    const a = fast.get(taskId)!;
    const b = slow.get(taskId)!;
    // Con duraciones distintas el orden puede variar: el rango cubre ambos escenarios.
    return {
      taskId,
      start: { min: Math.min(a.start, b.start), max: Math.max(a.start, b.start) },
      end: { min: Math.min(a.end, b.end), max: Math.max(a.end, b.end) },
    };
  });
  const ends = (map: Map<string, { end: number }>) => Math.max(origin, ...[...map.values()].map((r) => r.end));
  return { tasks, end: { min: ends(fast), max: ends(slow) } };
}


export type DeadlineStatus = "on_track" | "at_risk" | "late";

/** Llegas incluso en el escenario lento, solo en el rápido o en ninguno. El día límite cuenta entero. */
export function deadlineStatus(timeline: Timeline, startDate: string, deadline: string): DeadlineStatus {
  const limit = daysBetween(startDate, deadline) + 1;
  if (timeline.end.max <= limit) return "on_track";
  if (timeline.end.min <= limit) return "at_risk";
  return "late";
}