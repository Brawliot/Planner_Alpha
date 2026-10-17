"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";
import { saveEdits, type EditState } from "@/app/actions/report";
import type { EditField, EditTopic } from "@/lib/report/edit";
import { reportTexts } from "@/lib/report/i18n";
import type { Language } from "@/lib/report/narrative";
import { Button, buttonStyles } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field } from "@/components/ui/field";

const TOPIC_ORDER: EditTopic[] = ["business", "market", "founder", "resources", "location", "risk"];
const INITIAL: EditState = { error: null };

type EditFormProps = {
  reportId: string;
  language: Language;
  fields: EditField[];
  budget: number | null;
};

export function EditForm({ reportId, language, fields, budget }: EditFormProps) {
  const t = reportTexts(language);
  const action = useMemo(() => saveEdits.bind(null, reportId), [reportId]);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} lang={language} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.editTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.editHelp}</p>
      </div>

      {TOPIC_ORDER.map((topic) => {
        const topicFields = fields.filter((field) => field.topic === topic);
        if (topicFields.length === 0 && topic !== "resources") return null;
        return (
          <section key={topic} aria-labelledby={`topic-${topic}`} className="flex flex-col gap-5">
            <h2 id={`topic-${topic}`} className="text-lg font-semibold">
              {t.topic[topic]}
            </h2>
            {topicFields.map((field) => (
              <ChoiceGroup
                key={field.key}
                name={field.key}
                legend={field.estimated ? `${field.prompt} (${t.estimated})` : field.prompt}
                options={field.options}
                defaultValue={field.current}
              />
            ))}
            {topic === "resources" && (
              <Field
                label={t.budgetExact}
                name="budget_eur"
                type="number"
                inputMode="numeric"
                min={0}
                max={50_000_000}
                step={1}
                defaultValue={budget ?? ""}
                className="max-w-60"
              />
            )}
          </section>
        );
      })}

      <p aria-live="polite" className="text-sm text-danger">
        {state.error ? t.editError[state.error] : null}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href={`/informe/${reportId}`} className={buttonStyles("secondary", "min-h-11")}>
          {t.cancel}
        </Link>
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? t.saving : t.saveChanges}
        </Button>
      </div>
    </form>
  );
}