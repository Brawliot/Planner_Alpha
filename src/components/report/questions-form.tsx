"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/report";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { AnalysisWait } from "./analysis-wait";
import { NOT_DECIDED } from "@/lib/report/certainty";
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const canSkip = questions.some((q) => q.options.includes(NOT_DECIDED));
  // La última pantalla dispara el análisis completo (~17 s): mientras tanto, la espera.
  const waiting = pending && to === totalQuestions;

  // Al llegar a un tema nuevo (se monta de nuevo por key), el foco va a su título: el lector lo anuncia.
  // En la primera pantalla no: el usuario acaba de llegar y no se le mueve el foco.
  useEffect(() => {
    if (from > 1) headingRef.current?.focus();
  }, [from]);

  return (
    <>
      {waiting && <AnalysisWait />}
      {/* Oculto, no desmontado: la acción en curso no se toca. */}
      <form action={formAction} hidden={waiting} className="flex flex-col gap-8">
      <input type="hidden" name="topic" value={topic} />
      <TopicProgress topics={topics} />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {from === to ? `Pregunta ${from} de ${totalQuestions}` : `Preguntas ${from}–${to} de ${totalQuestions}`}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-bold tracking-tighter outline-none">
          {title}
        </h1>
        {canSkip && (
          <p className="text-muted-foreground">
            Si no lo sabes, dilo: lo marcaremos como{" "}
            <span className="rounded-full border border-dashed border-muted-foreground px-2 text-xs">por confirmar</span>.
          </p>
        )}
      </div>

      {questions.map((q, index) => (
        <div
          key={q.key}
          className="rise rounded-[1.25rem] bg-surface p-6 shadow-soft"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <ChoiceGroup name={q.key} legend={q.prompt} options={q.options} required />
        </div>
      ))}

      <div className="flex flex-col items-end gap-2">
        <Button type="submit" variant="accent" disabled={pending} className="min-h-11 gap-2 px-6">
          {pending ? (
            "Guardando…"
          ) : (
            <>
              Continuar <span aria-hidden="true">→</span>
            </>
          )}
        </Button>
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      </div>
      </form>
    </>
  );
}

/** Una barra por tema: hechos en lima, el actual en lima tenue, los pendientes en gris. */
function TopicProgress({ topics }: { topics: QuestionStep["topics"] }) {
  return (
    <nav aria-label="Progreso">
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
              {state === "done" && <span className="sr-only"> (hecho)</span>}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}