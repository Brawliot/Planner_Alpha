"use client";

import { useActionState, useMemo } from "react";
import { saveConfig, type PlanFormState } from "@/app/actions/plan";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { HOURS_OPTIONS } from "@/lib/plan/config-form";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { PlanView } from "@/lib/plan/view";

const DELEGATION = ["self", "ai", "third_party"] as const;
const PROFESSIONALS = ["advisor", "lawyer", "designer", "developer"] as const;

export function ConfigForm({
  reportId,
  version,
  values,
  t,
}: {
  reportId: string;
  version: number;
  values: PlanView["form"];
  t: PlanTexts;
}) {
  const action = useMemo(() => saveConfig.bind(null, reportId), [reportId]);
  const [state, formAction, pending] = useActionState<PlanFormState, FormData>(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="version" value={version} />
      <Field label={t.startDate} type="date" name="startDate" defaultValue={values.startDate} required />

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t.hours}
        <select name="hours" defaultValue={values.hours} className="rounded-md border border-input bg-background px-3 py-2 text-base font-normal">
          {Object.keys(HOURS_OPTIONS).map((key) => (
            <option key={key} value={key}>
              {key} h
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="font-medium">{t.delegation}</legend>
        {DELEGATION.map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input type="checkbox" name="delegation" value={option} defaultChecked={values.delegation.includes(option)} />
            {t.delegationOption[option]}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="font-medium">{t.professionals}</legend>
        {PROFESSIONALS.map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input type="checkbox" name="professionals" value={option} defaultChecked={values.professionals.includes(option)} />
            {t.professional[option]}
          </label>
        ))}
      </fieldset>

      {(["validationLevel", "launchLevel"] as const).map((name) => (
        <label key={name} className="flex flex-col gap-1 text-sm font-medium">
          {t[name]}
          <select name={name} defaultValue={String(values[name])} className="rounded-md border border-input bg-background px-3 py-2 text-base font-normal">
            {t.levels.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}

      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? t.saving : t.save}
      </Button>
      <p aria-live="polite" role="status" className="text-sm text-danger">
        {state.error}
      </p>
    </form>
  );
}