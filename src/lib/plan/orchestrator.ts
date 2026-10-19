import { moneyCheck } from "../report/money.ts";
import type { PlanConfig } from "./config.ts";
import { buildSkeleton, type Decision } from "./engine.ts";
import type { PlanInput } from "./input.ts";
import { lineIssues, type Line } from "./line.ts";
import { mergeTasks } from "./merge.ts";
import type { Mold } from "./mold.ts";
import { isTaskResolved, taskTotals, type Range, type Task } from "./task.ts";
import { buildTimeline, deadlineStatus, type DeadlineStatus, type Timeline } from "./timeline.ts";

/**
 * Orquestador: recalcula el plan cada vez que algo cambia (informe, configuración o progreso).
 * Decisor → mezcla sin pisar lo del usuario → timeline → avisos. Función pura: no guarda ni llama a modelos.
 */

/** Lo que se guarda de un plan entre cálculos. */
export interface StoredPlan {
  lines: Line[];
  tasks: Task[];
  /** Sugerencias que el usuario quitó: no vuelven. */
  dismissed: string[];
  /** Huella del informe con la que se calculó. */
  fingerprint: string;
}

export type MoneyStatus = "fits" | "at_risk" | "over";

export interface PlanState {
  lines: Line[];
  tasks: Task[];
  decisions: Decision[];
  timeline: Timeline;
  /** null si no hay fecha límite. */
  deadline: DeadlineStatus | null;
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
  /** Solo para el log del servidor; nunca se muestra al usuario. */
  issues: string[];
}

/** Terminada: todo resuelto y algo hecho. Solo saltada no cuenta. */
const isFinished = (task: Task) => isTaskResolved(task) && task.steps.some((step) => step.status === "done");

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
  const merged = mergeTasks(
    stored.tasks.filter((task) => !finishedIds.has(task.id)),
    skeleton.tasks.filter((task) => !finishedIds.has(task.id)),
    new Set(stored.dismissed),
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

  return {
    lines,
    tasks,
    decisions: skeleton.decisions,
    timeline,
    deadline: config.deadline ? deadlineStatus(timeline, config.startDate, config.deadline) : null,
    money: moneyOf(report, tasks),
    reportChanged: input.stored !== null && input.stored.fingerprint !== report.fingerprint,
    fingerprint: report.fingerprint,
    dismissed: stored.dismissed,
    issues: [...skeleton.issues, ...lineIssues(lines, tasks)],
  };
}