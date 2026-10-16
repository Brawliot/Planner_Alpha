"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/report";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";

type Question = { key: string; prompt: string; options: string[] };

type QuestionsFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  topic: string;
  title: string;
  index: number;
  total: number;
  questions: Question[];
};

export function QuestionsForm({ action, topic, title, index, total, questions }: QuestionsFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="topic" value={topic} />
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Step {index} of {total}
        </p>
      </div>
      {questions.map((q) => (
        <ChoiceGroup key={q.key} name={q.key} legend={q.prompt} options={q.options} required />
      ))}
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "Saving…" : "Continue"}
      </Button>
      <p aria-live="polite" className="text-sm text-danger">
        {state.error}
      </p>
    </form>
  );
}