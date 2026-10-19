import type { Fact } from "../report/facts.ts";
import type { Language } from "../report/narrative.ts";
import { taskCertainty } from "./certainty.ts";
import { canGenerate, canRegenerate } from "./concretion.ts";
import type { PlanConfig } from "./config.ts";
import { hoursOptionOf, type HoursOption } from "./config-form.ts";
import { stateLabel } from "./engine.ts";
import type { Department } from "./line.ts";
import type { Mold } from "./mold.ts";
import type { MoneyStatus, PlanState } from "./orchestrator.ts";
import { stepActions } from "./progress.ts";
import type { Actor, StepStatus, ThirdParty } from "./step.ts";
import {
  PHASES,
  isStepResolved,
  isTaskResolved,
  pendingDependencies,
  taskOutOfOrder,
  taskStatus,
  type Range,
  type Task,
} from "./task.ts";
import { addDays, weeksOf, type DeadlineStatus } from "./timeline.ts";

/**
 * Vista del plan: lo único que llega al navegador. Cifras y fechas ya calculadas por el código;
 * nunca datos internos (log, huella, orígenes de los datos).
 */

type Phase = (typeof PHASES)[number];

export interface PlanStepView {
  id: string;
  text: string;
  actor: Actor;
  status: StepStatus;
  /** Botones que se ofrecen (transiciones válidas). */
  actions: StepStatus[];
  effort: Range;
  wait: Range | null;
  cost: Range | null;
}

export interface DoneTaskView {
  id: string;
  title: string;
  department: Department | null;
  personalized: boolean;
  steps: PlanStepView[];
}

export interface PlanTaskView extends DoneTaskView {
  weeks: { from: number; to: number };
  dates: { from: string; to: string };
  estimated: boolean;
  /** Tareas que van antes (títulos). */
  after: string[];
  /** Las que aún no están hechas (bloqueo blando: se avisa, no se impide). */
  blockedBy: string[];
  /** Se avanzó aunque había algo pendiente antes. */
  outOfOrder: boolean;
  /** Qué botón de IA se ofrece; null si ninguno (ya empezada). */
  generate: "generate" | "regenerate" | null;
  /** Preguntas previas pendientes de esta tarea. */
  questions: { id: string; text: string; options: string[] }[];
  /** Molde de la tarea (para responder sus preguntas previas). */
  mold: string | null;
}

export interface NowItem {
  taskId: string;
  title: string;
  /** Siguiente paso que puedes hacer, o null si solo queda esperar. */
  step: PlanStepView | null;
  /** A quién se espera, si solo queda esperar. */
  waitingFor: ThirdParty | null;
}

export interface PlanView {
  language: Language;
  opening: { weeks: { from: number; to: number }; dates: { from: string; to: string } } | null;
  money: MoneyStatus | null;
  deadline: DeadlineStatus | null;
  decisions: { label: string; options: string[]; chosen: string }[];
  now: NowItem[];
  phases: { phase: Phase; tasks: PlanTaskView[]; done: DoneTaskView[] }[];
  form: {
    startDate: string;
    hours: HoursOption;
    delegation: PlanConfig["delegation"];
    professionals: PlanConfig["professionals"];
    validationLevel: PlanConfig["validationLevel"];
    launchLevel: PlanConfig["launchLevel"];
  };
}

export const NOW_SIZE = 3;

function stepView(step: Task["steps"][number]): PlanStepView {
  return {
    id: step.id,
    text: step.text,
    actor: step.actor,
    status: step.status,
    actions: stepActions(step.actor, step.status),
    effort: step.effort,
    wait: step.wait ?? null,
    cost: step.cost ?? null,
  };
}

export function planView(input: {
  state: PlanState;
  config: PlanConfig;
  catalog: readonly Mold[];
  facts: readonly Fact[];
  language: Language;
}): PlanView {
  const { state, config, catalog, facts, language } = input;
  const tasks = state.tasks.filter((t) => t.archived === undefined);
  const schedule = new Map(state.timeline.tasks.map((s) => [s.taskId, s]));
  const departmentOf = new Map(state.lines.map((line) => [line.id, line.department]));
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  const moldTitle = (id: string) => catalog.find((m) => m.id === id)?.title[language] ?? id;
  const titles = (ids: readonly string[]) => ids.flatMap((id) => (titleOf.has(id) ? [titleOf.get(id)!] : []));

  const base = (task: Task): DoneTaskView => ({
    id: task.id,
    title: task.title,
    department: departmentOf.get(task.lineId) ?? null,
    personalized: task.origin === "ai",
    steps: task.steps.map(stepView),
  });

  const pending: (PlanTaskView & { phase: Phase; start: number })[] = [];
  const done: (DoneTaskView & { phase: Phase })[] = [];
  for (const task of tasks) {
    const s = schedule.get(task.id);
    if (isTaskResolved(task) || !s) {
      done.push({ ...base(task), phase: task.phase });
      continue;
    }
    pending.push({
      ...base(task),
      weeks: weeksOf(s),
      dates: { from: addDays(config.startDate, s.start.min), to: addDays(config.startDate, s.end.max) },
      estimated: taskCertainty(task, facts) === "estimated",
      after: titles(task.dependsOn),
      blockedBy: titles(pendingDependencies(task, tasks)),
      outOfOrder: taskOutOfOrder(task, tasks),
      generate: canGenerate(task) ? "generate" : canRegenerate(task) ? "regenerate" : null,
      questions: state.pendingQuestions
        .filter((q) => task.mold !== undefined && q.mold === task.mold)
        .map((q) => ({ id: q.id, text: q.text, options: q.options })),
      mold: task.mold ?? null,
      phase: task.phase,
      start: s.start.min,
    });
  }

  // "Ahora": lo que se puede empezar ya (sin nada pendiente antes), en el orden del timeline.
  const now = pending
    .filter((t) => t.blockedBy.length === 0)
    .sort((a, b) => a.start - b.start)
    .slice(0, NOW_SIZE)
    .map((view): NowItem => {
      const task = tasks.find((t) => t.id === view.id)!;
      const open = task.steps.filter((s) => !isStepResolved(s));
      const next = open.find((s) => s.status !== "requested") ?? null;
      const waiting = taskStatus(task, tasks) === "waiting" ? (open[0]?.thirdParty ?? "other") : null;
      return { taskId: task.id, title: task.title, step: next ? stepView(next) : null, waitingFor: next ? null : waiting };
    });

  const opening = state.opening
    ? (() => {
        const from = Math.max(1, Math.ceil(state.opening.min / 7));
        return {
          weeks: { from, to: Math.max(from, Math.ceil(state.opening.max / 7)) },
          dates: { from: addDays(config.startDate, state.opening.min), to: addDays(config.startDate, state.opening.max) },
        };
      })()
    : null;

  const strip = <T extends { phase?: unknown; start?: unknown }>(item: T) => {
    const copy = { ...item };
    delete copy.phase;
    delete copy.start;
    return copy;
  };

  return {
    language,
    opening,
    money: state.money.status,
    deadline: state.deadline,
    decisions: state.decisions.map((d) => ({
      label: stateLabel(d.state, language),
      options: d.options.map(moldTitle),
      chosen: moldTitle(d.chosen),
    })),
    now,
    phases: PHASES.map((phase) => ({
      phase,
      tasks: pending
        .filter((t) => t.phase === phase)
        .sort((a, b) => a.start - b.start)
        .map((t) => strip(t) as PlanTaskView),
      done: done.filter((t) => t.phase === phase).map((t) => strip(t) as DoneTaskView),
    })).filter((group) => group.tasks.length > 0 || group.done.length > 0),
    form: {
      startDate: config.startDate,
      hours: hoursOptionOf(config.weeklyHours) ?? "10-20",
      delegation: config.delegation,
      professionals: config.professionals,
      validationLevel: config.validationLevel,
      launchLevel: config.launchLevel,
    },
  };
}