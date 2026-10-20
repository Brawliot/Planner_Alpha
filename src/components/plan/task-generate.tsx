"use client";

import { useActionState, useMemo } from "react";
import { answerAndGenerateAction, generateTaskAction, type GenerateState } from "@/app/actions/plan";
import { Button } from "@/components/ui/button";
import type { PlanTexts } from "@/lib/plan/i18n";
import { OTHER_REPLY, UNKNOWN_REPLY } from "@/lib/plan/replies-form";
import type { PlanTaskView } from "@/lib/plan/view";

const INITIAL: GenerateState = { error: null };

export function TaskGenerate({
  reportId,
  version,
  task,
  mold,
  t,
  returnTo,
}: {
  reportId: string;
  version: number;
  task: PlanTaskView;
  mold: string | null;
  t: PlanTexts;
  /** "task": tras personalizar, vuelve a la página de la tarea (si no, al plan). */
  returnTo?: "task";
}) {
  const generate = useMemo(() => generateTaskAction.bind(null, reportId, task.id), [reportId, task.id]);
  const answer = useMemo(
    () => answerAndGenerateAction.bind(null, reportId, task.id, mold ?? ""),
    [reportId, task.id, mold],
  );
  const [generateState, generateAction, generating] = useActionState(generate, INITIAL);
  const [answerState, answerAction, answering] = useActionState(answer, INITIAL);
  const pending = generating || answering;
  const error = generateState.error ?? answerState.error;

  if (task.questions.length === 0 && task.generate === null) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {task.questions.length > 0 && mold ? (
        <form action={answerAction} className="flex flex-col gap-3">
          <input type="hidden" name="version" value={version} />
          {returnTo && <input type="hidden" name="return" value={returnTo} />}
          <p className="text-sm font-medium">{t.questionsIntro}</p>
          {task.questions.map((q) => (
            <fieldset key={q.id} className="flex flex-col gap-1 text-sm">
              <legend className="font-medium">{q.text}</legend>
              {[...q.options.map((o) => ({ value: o, label: o })), { value: UNKNOWN_REPLY, label: t.unknown }, { value: OTHER_REPLY, label: t.other }].map(
                (option) => (
                  <label key={option.value} className="flex items-center gap-2">
                    <input type="radio" name={`q:${q.id}`} value={option.value} required />
                    {option.label}
                  </label>
                ),
              )}
              <label className="flex flex-col gap-1">
                {t.otherLabel}
                <input
                  name={`other:${q.id}`}
                  maxLength={200}
                  className="rounded-md border border-input bg-background px-3 py-2 text-base font-normal"
                />
              </label>
            </fieldset>
          ))}
          <Button type="submit" disabled={pending} className="min-h-11 self-start">
            {t.answer}
          </Button>
        </form>
      ) : (
        <form action={generateAction}>
          <input type="hidden" name="version" value={version} />
          {returnTo && <input type="hidden" name="return" value={returnTo} />}
          <Button type="submit" variant="secondary" disabled={pending} className="min-h-11">
            {task.generate === "regenerate" ? t.regenerate : t.generate}
          </Button>
        </form>
      )}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {pending ? t.generating : ""}
      </p>
      <p aria-live="polite" className="text-sm text-danger">
        {error ? t.generateError[error] : null}
      </p>
    </div>
  );
}