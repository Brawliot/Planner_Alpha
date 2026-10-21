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
  returnTo,
  emphasis = false,
  only,
}: {
  reportId: string;
  taskId: string;
  version: number;
  step: PlanStepView;
  t: PlanTexts;
  /** "task": tras guardar, vuelve a la página de la tarea (si no, al plan). */
  returnTo?: "task";
  /** Paso actual: el primer botón es el principal (lima) y todos miden 44 px. */
  emphasis?: boolean;
  /** "primary": solo la acción principal (filas compactas como "Ahora"). */
  only?: "primary";
}) {
  const action = useMemo(() => markStepAction.bind(null, reportId, taskId, step.id), [reportId, taskId, step.id]);
  const [state, formAction, pending] = useActionState<ProgressState, FormData>(action, { error: null });
  if (step.actions.length === 0) return null;

  return (
    <form action={formAction} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="version" value={version} />
      {returnTo && <input type="hidden" name="return" value={returnTo} />}
      {(only === "primary" ? step.actions.slice(0, 1) : step.actions).map((to, index) => (        <Button
          key={to}
          type="submit"
          name="to"
          value={to}
          variant={emphasis && index === 0 ? "accent" : "secondary"}
          disabled={pending}
          className={emphasis ? "min-h-11" : "min-h-9 px-3 py-1 text-xs"}
        >
          {t.action[to]}
        </Button>
      ))}
      <span aria-live="polite" className="text-xs text-danger">
        {state.error ? t.progressError[state.error] : null}
      </span>
    </form>
  );
}