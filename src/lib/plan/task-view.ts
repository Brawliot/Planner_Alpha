import type { PlanState } from "./orchestrator.ts";
import type { Range } from "./task.ts";
import type { DoneTaskView, PlanStepView, PlanTaskView, PlanView } from "./view.ts";

/**
 * Vista de la página de una tarea: se construye sobre planView (mismos títulos, fechas y estados)
 * y añade su contexto: posición en el plan, antes/desbloquea, paso actual, resumen y alternativa.
 */

export interface TaskLink {
  id: string;
  title: string;
  done: boolean;
}

export type TaskPageTask = (PlanTaskView & { done: false }) | (DoneTaskView & { done: true });

export interface TaskPageView {
  language: PlanView["language"];
  phase: PlanView["phases"][number]["phase"];
  task: TaskPageTask;
  /** Posición en el orden del plan (1..total). */
  position: { index: number; total: number };
  previous: TaskLink | null;
  next: TaskLink | null;
  /** Tareas de las que depende. */
  before: TaskLink[];
  /** Tareas que dependen de esta. */
  unlocks: TaskLink[];
  /** Primer paso sin resolver (aunque esté pedido a un tercero); null si todo está resuelto. */
  currentStepId: string | null;
  summary: {
    done: number;
    total: number;
    /** Horas tuyas pendientes: tus pasos y revisar los de la IA. Siempre estimadas (catálogo). */
    userHours: Range;
    aiDrafts: number;
    aiPending: number;
    /** Espera más larga de los terceros pendientes (pueden correr a la vez); null si no hay. */
    wait: Range | null;
  };
  /** Si la tarea sale de una decisión del plan. */
  alternative: { label: string; options: string[]; chosen: string } | null;
}

const resolved = (step: PlanStepView) => step.status === "done" || step.status === "skipped";
const add = (a: Range, b: Range): Range => ({ min: a.min + b.min, max: a.max + b.max });
const larger = (a: Range, b: Range): Range => ({ min: Math.max(a.min, b.min), max: Math.max(a.max, b.max) });

export function taskPageView(view: PlanView, state: PlanState, taskId: string): TaskPageView | null {
  // Orden del plan: por fases; en cada una, las pendientes y después las hechas.
  const ordered = view.phases.flatMap((group) => [
    ...group.tasks.map((task) => ({ phase: group.phase, task: { ...task, done: false as const } })),
    ...group.done.map((task) => ({ phase: group.phase, task: { ...task, done: true as const } })),
  ]);
  const index = ordered.findIndex((entry) => entry.task.id === taskId);
  if (index === -1) return null;

  const { phase, task } = ordered[index];
  const link = (entry: (typeof ordered)[number] | undefined): TaskLink | null =>
    entry ? { id: entry.task.id, title: entry.task.title, done: entry.task.done } : null;
  const linkById = (id: string) => link(ordered.find((entry) => entry.task.id === id));

  const active = state.tasks.filter((t) => t.archived === undefined);
  const stored = active.find((t) => t.id === taskId);
  const before = (stored?.dependsOn ?? []).flatMap((id) => linkById(id) ?? []);
  const unlocks = active.filter((t) => t.dependsOn.includes(taskId)).flatMap((t) => linkById(t.id) ?? []);

  const pending = task.steps.filter((step) => !resolved(step));
  const decisionIndex = state.decisions.findIndex((d) => d.taskId === taskId);
  const decision = decisionIndex === -1 ? undefined : view.decisions[decisionIndex];

  return {
    language: view.language,
    phase,
    task,
    position: { index: index + 1, total: ordered.length },
    previous: link(ordered[index - 1]),
    next: link(ordered[index + 1]),
    before,
    unlocks,
    currentStepId: pending[0]?.id ?? null,
    summary: {
      done: task.steps.length - pending.length,
      total: task.steps.length,
      userHours: pending
        .filter((step) => step.actor === "user" || step.actor === "ai")
        .reduce((sum, step) => add(sum, step.effort), { min: 0, max: 0 }),
      aiDrafts: pending.filter((step) => step.status === "ai_draft").length,
      aiPending: pending.filter((step) => step.actor === "ai" && step.status === "todo").length,
      wait: pending
        .filter((step) => step.actor === "third_party" && step.wait)
        .reduce<Range | null>((max, step) => (max ? larger(max, step.wait!) : step.wait), null),
    },
    alternative: decision ? { label: decision.label, options: decision.options, chosen: decision.chosen } : null,
  };
}