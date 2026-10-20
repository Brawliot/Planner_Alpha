"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/report";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import type { QuestionStep } from "@/lib/report/questions";
import { cn } from "@/lib/cn";

type Question = { key: string; prompt: string; options: string[] };

type QuestionsFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  topic: string;
  title: string;
  from: number;
  to: number;
  totalQuestions: number;
  topics: QuestionStep["topics"];
  questions: Question[];
};

export function QuestionsForm({ action, topic, title, from, to, totalQuestions, topics, questions }: QuestionsFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="topic" value={topic} />
      <TopicProgress topics={topics} />
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {from === to ? `Question ${from} of ${totalQuestions}` : `Questions ${from}–${to} of ${totalQuestions}`}
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

/** Una barra por tema: hechos en lima, el actual en lima tenue, los pendientes en gris. */
function TopicProgress({ topics }: { topics: QuestionStep["topics"] }) {
  return (
    <nav aria-label="Progress">
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${topics.length}, minmax(0, 1fr))` }}>
        {topics.map(({ topic, title, state }) => (
          <li
            key={topic}
            aria-current={state === "current" ? "step" : undefined}
            className="flex flex-col gap-2 text-xs font-medium"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 rounded-full",
                state === "done" ? "bg-accent" : state === "current" ? "bg-accent/40" : "bg-muted",
              )}
            />
            <span className={state === "current" ? "text-foreground" : "text-muted-foreground"}>
              {state === "done" && <span aria-hidden="true">✓ </span>}
              {title}
              {state === "done" && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}