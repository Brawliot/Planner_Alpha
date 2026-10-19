"use client";

import { useActionState, useMemo } from "react";
import { markStepAction, type ProgressState } from "@/app/actions/plan";
import { Button } from "@/components/ui/button";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { PlanStepView } from "@/lib/plan/view";

export function StepActions({
  reportId,
  taskId,
  version,
  step,
  t,
}: {
  reportId: string;
  taskId: string;
  version: number;
  step: PlanStepView;
  t: PlanTexts;
}) {
  const action = useMemo(() => markStepAction.bind(null, reportId, taskId, step.id), [reportId, taskId, step.id]);
  const [state, formAction, pending] = useActionState<ProgressState, FormData>(action, { error: null });
  if (step.actions.length === 0) return null;

  return (
    <form action={formAction} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="version" value={version} />
      {step.actions.map((to) => (
        <Button key={to} type="submit" name="to" value={to} variant="secondary" disabled={pending} className="min-h-9 px-3 py-1 text-xs">
          {t.action[to]}
        </Button>
      ))}
      <span aria-live="polite" className="text-xs text-danger">
        {state.error ? t.progressError[state.error] : null}
      </span>
    </form>
  );
}