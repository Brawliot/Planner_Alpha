import Link from "next/link";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { Range } from "@/lib/plan/task";
import type { PlanStepView, PlanView } from "@/lib/plan/view";
import { ConfigForm } from "./config-form";
import { StepActions } from "./step-actions";
import { TaskGenerate } from "./task-generate";

function formatDate(iso: string, language: PlanView["language"]) {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

function range(r: Range, unit: string, language: PlanView["language"]) {
  const n = (v: number) => v.toLocaleString(language === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: 2 });
  return r.min === r.max ? `${n(r.min)} ${unit}` : `${n(r.min)}–${n(r.max)} ${unit}`;
}

export function PlanScreen({ view, t, reportId, version }: { view: PlanView; t: PlanTexts; reportId: string; version: number }) {
  const { language } = view;
  const dates = (d: { from: string; to: string }) => `${formatDate(d.from, language)} – ${formatDate(d.to, language)}`;

  const steps = (taskId: string, list: PlanStepView[]) => (
    <ul className="mt-2 flex flex-col gap-2 pl-1 text-sm">
      {list.map((step) => (
        <li key={step.id}>
          <span className={step.status === "done" || step.status === "skipped" ? "text-muted-foreground line-through" : ""}>
            {step.text}
          </span>{" "}
          <span className="text-muted-foreground">
            ({t.actor[step.actor]}; {range(step.effort, "h", language)}
            {step.wait ? `; ${t.wait} ${range(step.wait, "d", language)}` : ""}
            {step.cost ? `; ${range(step.cost, "€", language)}` : ""}) · {t.status[step.status]}
          </span>
          <StepActions reportId={reportId} taskId={taskId} version={version} step={step} t={t} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        {view.opening && (
          <p className="text-base">
            {t.opening}: {t.weeks} {view.opening.weeks.from}–{view.opening.weeks.to} · {dates(view.opening.dates)}{" "}
            <span className="text-sm text-muted-foreground">({t.estimated})</span>
          </p>
        )}
        {view.money && <p className="text-sm">{t.money[view.money]}</p>}
        {view.deadline && <p className="text-sm">{t.deadline[view.deadline]}</p>}
      </header>

      <section aria-labelledby="now" className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h2 id="now" className="text-lg font-semibold">
          {t.now}
        </h2>
        {view.now.length === 0 ? (
          <p className="text-sm">{t.nowEmpty}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {view.now.map((item) => (
              <li key={item.taskId} className="text-sm">
                <a href={`#tarea-${item.taskId}`} className="font-medium underline">
                  {item.title}
                </a>
                {item.step ? (
                  <div>
                    {t.nextStep}: {item.step.text}
                    <StepActions reportId={reportId} taskId={item.taskId} version={version} step={item.step} t={t} />
                  </div>
                ) : item.waitingFor ? (
                  <p>
                    {t.waitingFor} {t.thirdParty[item.waitingFor]}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {view.decisions.length > 0 && (
        <section aria-labelledby="decisions" className="flex flex-col gap-2">
          <h2 id="decisions" className="text-lg font-semibold">
            {t.decisions}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {view.decisions.map((d) => (
              <li key={d.label}>
                {d.label}: {d.options.join(" / ")} ({t.provisional}: {d.chosen})
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-md border border-border p-4">
        <summary className="cursor-pointer font-medium">{t.adjust}</summary>
        <div className="mt-4">
          <ConfigForm reportId={reportId} version={version} values={view.form} t={t} />
        </div>
      </details>

      {view.phases.map((group) => (
        <section key={group.phase} aria-labelledby={`phase-${group.phase}`} className="flex flex-col gap-3">
          <h2 id={`phase-${group.phase}`} className="text-xl font-semibold">
            {t.phase[group.phase]}
          </h2>
          <ul className="flex flex-col gap-3">
            {group.tasks.map((task) => (
              <li key={task.id} id={`tarea-${task.id}`} tabIndex={-1} className="rounded-md border border-border p-4">
                <h3 className="font-medium">
                  <Link
                    href={`/informe/${reportId}/plan/tarea/${encodeURIComponent(task.id)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {task.title}
                  </Link>
                  {task.personalized && (
                    <span className="ml-2 rounded-sm border border-border px-1.5 py-0.5 text-xs font-normal">{t.personalized}</span>
                  )}
                  {task.outOfOrder && (
                    <span className="ml-2 rounded-sm border border-border px-1.5 py-0.5 text-xs font-normal">{t.outOfOrder}</span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {task.department ? t.department[task.department] : ""} · {t.weeks} {task.weeks.from}–{task.weeks.to} ·{" "}
                  {dates(task.dates)}
                  {task.estimated ? ` · ${t.estimated}` : ""}
                </p>
                {task.blockedBy.length > 0 ? (
                  <p className="text-sm">
                    {t.blockedBy}: {task.blockedBy.join(", ")}
                  </p>
                ) : task.after.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t.after}: {task.after.join(", ")}
                  </p>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm">{t.steps}</summary>
                  {steps(task.id, task.steps)}
                </details>
                <TaskGenerate reportId={reportId} version={version} task={task} mold={task.mold} t={t} />
              </li>
            ))}
          </ul>
          {group.done.length > 0 && (
            <details className="rounded-md border border-border p-4">
              <summary className="cursor-pointer text-sm">
                {t.doneGroup} ({group.done.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-3">
                {group.done.map((task) => (
                  <li key={task.id} id={`tarea-${task.id}`} tabIndex={-1}>
                    <h3 className="text-sm font-medium text-muted-foreground line-through">{task.title}</h3>
                    {steps(task.id, task.steps)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}