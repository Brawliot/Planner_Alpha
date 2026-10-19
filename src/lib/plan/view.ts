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
import type { Actor } from "./step.ts";
import { PHASES, type Range } from "./task.ts";
import { addDays, weeksOf, type DeadlineStatus } from "./timeline.ts";

/**
 * Vista del plan: lo único que llega al navegador. Cifras y fechas ya calculadas por el código;
 * nunca datos internos (log, huella, orígenes de los datos).
 */

export interface PlanStepView {
  text: string;
  actor: Actor;
  effort: Range;
  wait: Range | null;
  cost: Range | null;
}

export interface PlanTaskView {
  id: string;
  title: string;
  department: Department | null;
  weeks: { from: number; to: number };
  dates: { from: string; to: string };
  estimated: boolean;
  steps: PlanStepView[];
  /** La personalizó la IA ("Personalizada"). */
  personalized: boolean;
  /** Qué botón de IA se ofrece; null si ninguno (ya empezada). */
  generate: "generate" | "regenerate" | null;
  /** Preguntas previas pendientes de esta tarea. */
  questions: { id: string; text: string; options: string[] }[];
    /** Molde de la tarea (para responder sus preguntas previas). */
  mold: string | null;
}

export interface PlanView {
  language: Language;
  opening: { weeks: { from: number; to: number }; dates: { from: string; to: string } } | null;
  money: MoneyStatus | null;
  deadline: DeadlineStatus | null;
  decisions: { label: string; options: string[]; chosen: string }[];
  phases: { phase: (typeof PHASES)[number]; tasks: PlanTaskView[] }[];
  form: {
    startDate: string;
    hours: HoursOption;
    delegation: PlanConfig["delegation"];
    professionals: PlanConfig["professionals"];
    validationLevel: PlanConfig["validationLevel"];
    launchLevel: PlanConfig["launchLevel"];
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
  const schedule = new Map(state.timeline.tasks.map((s) => [s.taskId, s]));
  const departmentOf = new Map(state.lines.map((line) => [line.id, line.department]));
  const moldTitle = (id: string) => catalog.find((m) => m.id === id)?.title[language] ?? id;

  const tasks = state.tasks.flatMap((task): (PlanTaskView & { phase: (typeof PHASES)[number]; start: number })[] => {
    const s = schedule.get(task.id);
    if (!s || task.archived !== undefined) return [];
    return [
      {
        id: task.id,
        title: task.title,
        department: departmentOf.get(task.lineId) ?? null,
        weeks: weeksOf(s),
        dates: { from: addDays(config.startDate, s.start.min), to: addDays(config.startDate, s.end.max) },
        estimated: taskCertainty(task, facts) === "estimated",
        steps: task.steps.map((step) => ({
          text: step.text,
          actor: step.actor,
          effort: step.effort,
          wait: step.wait ?? null,
          cost: step.cost ?? null,
        })),
        personalized: task.origin === "ai",
        generate: canGenerate(task) ? "generate" : canRegenerate(task) ? "regenerate" : null,
        questions: state.pendingQuestions
          .filter((q) => task.mold !== undefined && q.mold === task.mold)
          .map((q) => ({ id: q.id, text: q.text, options: q.options })),
        mold: task.mold ?? null,
        phase: task.phase,
        start: s.start.min,
      },
    ];
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
    phases: PHASES.map((phase) => ({
      phase,
      tasks: tasks
        .filter((t) => t.phase === phase)
        .sort((a, b) => a.start - b.start)
        .map((t) => {
          const task: PlanTaskView & { phase?: unknown; start?: unknown } = { ...t };
          delete task.phase;
          delete task.start;
          return task as PlanTaskView;
        }),
    })).filter((group) => group.tasks.length > 0),
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