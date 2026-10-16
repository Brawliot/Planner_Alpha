"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/report";
import { Button } from "@/components/ui/button";

type RetryFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

export function RetryForm({ action }: RetryFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {pending ? "Reintentando…" : "Reintentar"}
      </Button>
      <p aria-live="polite" className="text-sm text-danger">
        {state.error}
      </p>
    </form>
  );
}