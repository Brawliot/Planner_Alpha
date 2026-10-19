"use client";

import { useActionState, useMemo } from "react";
import { createPlan, type PlanFormState } from "@/app/actions/plan";
import { Button } from "@/components/ui/button";

export function CreatePlanForm({ reportId, label, pendingLabel }: { reportId: string; label: string; pendingLabel: string }) {
  const action = useMemo(() => createPlan.bind(null, reportId), [reportId]);
  const [state, formAction, pending] = useActionState<PlanFormState, FormData>(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? pendingLabel : label}
      </Button>
      <p aria-live="polite" className="text-sm text-danger">
        {state.error}
      </p>
    </form>
  );
}