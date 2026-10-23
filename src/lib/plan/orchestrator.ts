import { moneyCheck } from "../report/money.ts";
import type { PlanConfig } from "./config.ts";
import { buildSkeleton, type Decision } from "./engine.ts";
import type { PlanInput } from "./input.ts";
import { lineIssues, type Line } from "./line.ts";
import type { DraftQuestion, PlanAnswer } from "./answers.ts";
import { applyConcretions } from "./concretion.ts";
import { mergeTasks } from "./merge.ts";
import { moldGets, type Mold } from "./mold.ts";
import { isTaskResolved, taskTotals, type Range, type Task } from "./task.ts";
import { launchTargetOf } from "./prefill.ts";
import { buildTimeline, deadlineStatus, targetFit, type DeadlineStatus, type TargetFit, type Timeline } from "./timeline.ts";

/**
 * Orquestador: recalcula el plan cada vez que algo cambia (informe, configuración o progreso).
 * Decisor → mezcla sin pisar lo del usuario → timeline → avisos. Función pura: no guarda ni llama a modelos.
 */

/** Lo que se guarda de un plan entre cálculos. */
export interface StoredPlan {
  /** Versión de la forma de este objeto (sin ella = formato 0, anterior a numerarlo). */
  formatVersion?: number;
  lines: Line[];
  tasks: Task[];
  /** Sugerencias que el usuario quitó: no vuelven. */
  dismissed: string[];
  /** Huella del informe con la que se calculó. */
  fingerprint: string;
  /** "Lo que nos has contado" (preguntas previas de "Generar"). */
  answers?: PlanAnswer[];
  /** Preguntas hechas y aún sin contestar: se vuelven a mostrar tal cual. */
  pendingQuestions?: DraftQuestion[];
}

export type MoneyStatus = "fits" | "at_risk" | "over";

export interface PlanState {
  lines: Line[];
  tasks: Task[];
  decisions: Decision[];
  timeline: Timeline;
  /** Días hasta abrir (rápido y lento): fin de la tarea de primeros clientes; null si ya no está pendiente. */
  opening: Range | null;
  /** Fecha límite puesta a mano (targetDate), comparada con el día que abres. null si no hay. */
  deadline: DeadlineStatus | null;
  /** Plazo que dijo el usuario frente a la estimación. null si no dijo plazo o si cuadra. */
  target: { fit: Exclude<TargetFit, "within">; months: Range; cause: "hours" | "waits" } | null;
  money: {
    /** Coste de ejecución del plan (profesionales, tasas…), siempre estimado. */
    cost: Range;
    /** Lo que queda del presupuesto tras el coste de arranque; null si no se sabe. */
    available: Range | null;
    status: MoneyStatus | null;
  };
  /** El informe cambió desde el último cálculo. */
  reportChanged: boolean;
  fingerprint: string;
  dismissed: string[];
  answers: PlanAnswer[];
  pendingQuestions: DraftQuestion[];
  /** Solo para el log del servidor; nunca se muestra al usuario. */
  issues: string[];
}

/** Terminada: todo resuelto y algo hecho. Solo saltada no cuenta. */
const isFinished = (task: Task) => isTaskResolved(task) && task.steps.some((step) => step.status === "done");

/** La tarea sin tus horas: deja solo las esperas a terceros (para saber qué pesa más). */
const withoutEffort = (task: Task): Task => ({
  ...task,
  steps: task.steps.map((step) => ({ ...step, effort: { min: 0, max: 0 } })),
});

function moneyOf(input: Pick<PlanInput, "facts">, tasks: readonly Task[]): PlanState["money"] {
  const cost = tasks
    .filter((task) => task.archived === undefined)
    .map((task) => taskTotals(task).cost)
    .reduce((sum, range) => ({ min: sum.min + range.min, max: sum.max + range.max }), { min: 0, max: 0 });
  const check = moneyCheck(input.facts);
  if (!check.budget || !check.startupCost) return { cost, available: null, status: null };
  const available = { min: check.budget.amount - check.startupCost.max, max: check.budget.amount - check.startupCost.min };
  // Llega incluso en el peor caso, solo en el mejor o en ninguno (como la fecha límite).
  const status: MoneyStatus = cost.max <= available.min ? "fits" : cost.min <= available.max ? "at_risk" : "over";
  return { cost, available, status };
}

export function rebuildPlan(input: {
  report: Pick<PlanInput, "facts" | "verdicts" | "language" | "fingerprint">;
  config: PlanConfig;
  catalog: readonly Mold[];
  stored: StoredPlan | null;
  /** Fecha ISO de hoy. */
  today: string;
}): PlanState {
  const { report, config } = input;
  const stored = input.stored ?? { lines: [], tasks: [], dismissed: [], fingerprint: report.fingerprint };

  const skeleton = buildSkeleton({
    facts: report.facts,
    verdicts: report.verdicts,
    config,
    catalog: input.catalog,
    achieved: [],
    language: report.language,
  });

  // Lo terminado se queda como está aunque el decisor ya no lo pida (su dato ya es verdad gracias a ello).
  const finished = stored.tasks.filter(isFinished);
  const finishedIds = new Set(finished.map((task) => task.id));
  const dismissed = new Set(stored.dismissed);
  // Las generadas por la IA ocupan el sitio de su molde antes de mezclar.
  const fresh = applyConcretions(skeleton.tasks, stored.tasks, dismissed);
  const merged = mergeTasks(
    stored.tasks.filter((task) => !finishedIds.has(task.id)),
    fresh.filter((task) => !finishedIds.has(task.id)),
    dismissed,
  );
  const tasks = [...finished, ...merged];

  // Líneas del esqueleto, más las guardadas que aún tienen tareas (terminadas o archivadas).
  const lines = [...skeleton.lines];
  for (const line of stored.lines) {
    if (!lines.some((l) => l.id === line.id) && tasks.some((task) => task.lineId === line.id)) lines.push(line);
  }

  const timeline = buildTimeline({
    tasks,
    startDate: config.startDate,
    today: input.today,
    weeklyHours: config.weeklyHours,
    unavailable: config.unavailable,
  });

  // Abrir = terminar la tarea que consigue los primeros clientes (lo que pasa a Operar va después).
  const openingIds = new Set(input.catalog.filter((mold) => moldGets(mold).includes("first_customers")).map((m) => m.id));
  const openingOf = (t: Timeline) => t.tasks.find((schedule) => openingIds.has(schedule.taskId))?.end ?? null;
  const opening = openingOf(timeline);

  // Tu plazo frente a la estimación: solo se avisa si no cuadra.
  const months = launchTargetOf(report.facts);
  const fit = months && opening ? targetFit(opening, months) : "within";
  let target: PlanState["target"] = null;
  if (months && opening && fit !== "within") {
    // Sin tus horas (solo esperas): si ya son la mitad del peor caso, la causa son las esperas.
    const waitsOnly = openingOf(
      buildTimeline({
        tasks: tasks.map(withoutEffort),
        startDate: config.startDate,
        today: input.today,
        weeklyHours: config.weeklyHours,
        unavailable: config.unavailable,
      }),
    );
    target = { fit, months, cause: waitsOnly !== null && waitsOnly.max * 2 >= opening.max ? "waits" : "hours" };
  }

  return {
    lines,
    tasks,
    decisions: skeleton.decisions,
    timeline,
    opening,
    deadline: config.targetDate
      ? deadlineStatus({ ...timeline, end: opening ?? timeline.end }, config.startDate, config.targetDate)
      : null,
    target,
    money: moneyOf(report, tasks),
    reportChanged: input.stored !== null && input.stored.fingerprint !== report.fingerprint,
    fingerprint: report.fingerprint,
    dismissed: stored.dismissed,
    answers: input.stored?.answers ?? [],
    pendingQuestions: input.stored?.pendingQuestions ?? [],
    issues: [...skeleton.issues, ...lineIssues(lines, tasks)],
  };
}