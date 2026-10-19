import type { PlanState, StoredPlan } from "./orchestrator.ts";

/** Lo que se guarda del plan recalculado: lo demás (timeline, decisiones, avisos) se recalcula. */
export function toStored(state: PlanState): StoredPlan {
  return {
    lines: state.lines,
    tasks: state.tasks,
    dismissed: state.dismissed,
    fingerprint: state.fingerprint,
    answers: state.answers,
    pendingQuestions: state.pendingQuestions,
  };
}