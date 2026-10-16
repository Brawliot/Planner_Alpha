"use client";

import { useActionState, useState } from "react";
import { createReport, type CreateReportState } from "@/app/actions/report";
import { IDEA_MAX_LENGTH } from "@/lib/report/idea";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: CreateReportState = { error: null };

export function PromptForm() {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState(createReport, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <Field
        label="Mensaje"
        name="idea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        maxLength={IDEA_MAX_LENGTH}
        autoComplete="off"
        className="w-full"
      />
      <Button type="submit" variant="primary" disabled={!text.trim() || pending} className="self-end">
        {pending ? "Enviando…" : "Enviar"}
      </Button>
      <p aria-live="polite" className="text-sm text-danger">
        {state.error}
      </p>
    </form>
  );
}