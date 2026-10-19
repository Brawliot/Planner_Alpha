import type { StoredPlan } from "./orchestrator.ts";
import { STEP_STATUSES, canTransition, type StepStatus } from "./step.ts";

/**
 * Marcar un paso. Solo transiciones válidas para su actor. Un paso de la IA nunca llega a "hecho"
 * desde aquí: eso es validar su borrador. null si la tarea, el paso o la transición no valen.
 */
export function setStepStatus(stored: StoredPlan, taskId: string, stepId: string, to: unknown): StoredPlan | null {
  if (typeof to !== "string" || !(STEP_STATUSES as readonly string[]).includes(to)) return null;
  const target = to as StepStatus;
  const task = stored.tasks.find((t) => t.id === taskId);
  const step = task?.steps.find((s) => s.id === stepId);
  if (!task || !step || task.archived !== undefined) return null;
  if (target === "ai_draft" || (step.actor === "ai" && target === "done")) return null;
  if (!canTransition(step.actor, step.status, target)) return null;

  return {
    ...stored,
    tasks: stored.tasks.map((t) =>
      t.id !== taskId ? t : { ...t, steps: t.steps.map((s) => (s.id === stepId ? { ...s, status: target } : s)) },
    ),
  };
}

/** Botones que se ofrecen para un paso: las transiciones válidas que el usuario puede hacer aquí. */
/** Lo que el usuario puede pedir con un botón (el borrador de la IA no se pide así). */
export type StepAction = Exclude<StepStatus, "ai_draft">;

export function stepActions(actor: Parameters<typeof canTransition>[0], status: StepStatus): StepAction[] {
  const candidates: StepAction[] = ["done", "skipped", "requested", "received", "todo"];
  return candidates.filter((to) => !(actor === "ai" && to === "done") && canTransition(actor, status, to));
}