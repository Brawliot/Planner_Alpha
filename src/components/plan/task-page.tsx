import Link from "next/link";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { Range } from "@/lib/plan/task";
import type { TaskLink, TaskPageView } from "@/lib/plan/task-view";
import type { PlanStepView } from "@/lib/plan/view";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { StepActions } from "./step-actions";
import { TaskGenerate } from "./task-generate";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const CHIP = "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground";

type Language = TaskPageView["language"];

function formatRange(r: Range, unit: string, language: Language) {
  const n = (v: number) => v.toLocaleString(language === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: 1 });
  return r.min === r.max ? `${n(r.min)} ${unit}` : `${n(r.min)}–${n(r.max)} ${unit}`;
}

function formatDate(iso: string, language: Language) {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

const resolved = (step: PlanStepView) => step.status === "done" || step.status === "skipped";

export function TaskPage({ page, t, reportId, version }: { page: TaskPageView; t: PlanTexts; reportId: string; version: number }) {
  const { task, language, summary } = page;
  const taskHref = (id: string) => `/informe/${reportId}/plan/tarea/${encodeURIComponent(id)}`;
  const who = (step: PlanStepView) =>
    step.actor === "third_party" ? t.task.whoThird(t.thirdParty[step.thirdParty ?? "other"]) : t.task.who[step.actor];
  const pct = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100);

  return (
    <div lang={language} className="flex flex-col gap-7 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={`/informe/${reportId}/plan`} className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground">
          <span aria-hidden="true">←&nbsp;</span>
          {t.title}
        </Link>
        <nav aria-label={t.steps} className="flex items-center gap-2">
          {page.previous && (
            <Link href={taskHref(page.previous.id)} className={buttonStyles("secondary", "min-h-11 rounded-full")}>
              <span aria-hidden="true">‹&nbsp;</span>
              {t.task.previous}
            </Link>
          )}
          <span className="text-xs text-muted-foreground">{t.task.position(page.position.index, page.position.total)}</span>
          {page.next && (
            <Link href={taskHref(page.next.id)} className={buttonStyles("secondary", "min-h-11 rounded-full")}>
              {t.task.next}
              <span aria-hidden="true">&nbsp;›</span>
            </Link>
          )}
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tighter [overflow-wrap:anywhere]">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {task.department && <span className={CHIP}>{t.department[task.department]}</span>}
          <span className={CHIP}>{t.phase[page.phase]}</span>
          {!task.done && (
            <>
              <span className={CHIP}>
                {t.weeks} {task.weeks.from}–{task.weeks.to} · {formatDate(task.dates.from, language)} – {formatDate(task.dates.to, language)}
              </span>
              {task.estimated && <EstimatedTag t={t} />}
            </>
          )}
          {task.personalized && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              <span aria-hidden="true">✦</span> {t.personalized}
            </span>
          )}
          {task.done && <span className={CHIP}>✓ {t.task.allDone}</span>}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[1.25rem] bg-surface px-5 py-4 text-sm shadow-soft">
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label={t.steps}
                aria-valuemin={0}
                aria-valuemax={summary.total}
                aria-valuenow={summary.done}
                className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <b>{t.task.progress(summary.done, summary.total)}</b>
            </div>
            {summary.userHours.max > 0 && (
              <span className="flex items-center gap-2">
                <WhoIcon actor="user" small />
                {formatRange(summary.userHours, "h", language)} {t.task.yourHours} <EstimatedTag t={t} />
              </span>
            )}
            {summary.aiDrafts > 0 && (
              <span className="flex items-center gap-2">
                <WhoIcon actor="ai" small />
                {t.task.drafts(summary.aiDrafts)}
              </span>
            )}
            {summary.aiPending > 0 && (
              <span className="flex items-center gap-2">
                <WhoIcon actor="ai" small />
                {t.task.aiPending(summary.aiPending)}
              </span>
            )}
            {summary.wait && (
              <span className="flex items-center gap-2">
                <WhoIcon actor="third_party" small />
                {formatRange(summary.wait, t.task.days, language)} {t.task.waitDays} <EstimatedTag t={t} />
              </span>
            )}
          </div>

          <ol className="relative flex flex-col gap-3">
            <span aria-hidden="true" className="absolute top-5 bottom-5 left-[19px] w-0.5 bg-border" />
            {task.steps.map((step) => {
              const actions = (emphasis: boolean) => (
                <StepActions
                  reportId={reportId}
                  taskId={task.id}
                  version={version}
                  step={step}
                  t={t}
                  returnTo="task"
                  emphasis={emphasis}
                />
              );

              if (resolved(step)) {
                return (
                  <li key={step.id} className="relative flex items-center gap-4">
                    <span
                      aria-hidden="true"
                      className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
                    >
                      {step.status === "skipped" ? "–" : "✓"}
                    </span>
                    <p className="flex-1 text-muted-foreground line-through decoration-muted-foreground/50">
                      {step.text}
                      <span className="sr-only"> · {t.status[step.status]}</span>
                    </p>
                    {actions(false)}
                  </li>
                );
              }

              if (step.id === page.currentStepId) {
                return (
                  <li key={step.id} className="relative flex gap-4">
                    <WhoIcon actor={step.actor} dashed={step.status === "requested"} />
                    <article className="flex min-w-0 flex-1 flex-col gap-4 rounded-[1.25rem] bg-surface p-5 shadow-soft ring-2 ring-accent">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={cn(LABEL, "text-accent")}>
                          {t.task.now} · {who(step)}
                        </p>
                        <span className={CHIP}>{t.status[step.status]}</span>
                      </div>
                      <h2 className="text-lg font-semibold">{step.text}</h2>
                      <StepFacts step={step} t={t} language={language} />
                      <div className="flex flex-col gap-1">
                        <p className={LABEL}>{t.task.doneWhen}</p>
                        <p className="text-sm">{step.doneWhen}</p>
                      </div>
                      {actions(true)}
                    </article>
                  </li>
                );
              }

              return (
                <li key={step.id} className="relative flex gap-4">
                  <WhoIcon actor={step.actor} dashed={step.status === "requested"} />
                  <details
                    className={cn(
                      "group min-w-0 flex-1 rounded-[1rem] bg-surface",
                      step.actor === "third_party" && "border border-dashed border-info/40",
                    )}
                  >
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <p className="font-medium">{step.text}</p>
                        <p className="sr-only">{who(step)}</p>
                        <StepChips step={step} t={t} language={language} />
                      </div>
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      >
                        ▾
                      </span>
                    </summary>
                    <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm">
                      <p className="text-muted-foreground">{who(step)}</p>
                      <div className="flex flex-col gap-1">
                        <p className={LABEL}>{t.task.doneWhen}</p>
                        <p>{step.doneWhen}</p>
                      </div>
                      {actions(false)}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>

          {!task.done && (
            <TaskGenerate reportId={reportId} version={version} task={task} mold={task.mold} t={t} returnTo="task" />
          )}
        </div>

        <aside className="flex flex-col gap-4 self-start md:sticky md:top-20">
          <section aria-labelledby="where-title" className="flex flex-col gap-3 rounded-[1.25rem] bg-surface p-5 text-sm shadow-soft">
            <h2 id="where-title" className={LABEL}>
              {t.task.where}
            </h2>
            {page.before.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{t.task.before}</p>
                <ul className="flex flex-col">
                  {page.before.map((link) => (
                    <li key={link.id}>
                      <TaskLinkRow link={link} href={taskHref(link.id)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p aria-current="page" className="flex items-center gap-3 rounded-lg bg-background px-2 py-2 font-semibold">
              <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-accent" />
              {t.task.thisTask}
            </p>
            {page.unlocks.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{t.task.unlocks}</p>
                <ul className="flex flex-col">
                  {page.unlocks.map((link) => (
                    <li key={link.id}>
                      <TaskLinkRow link={link} href={taskHref(link.id)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {page.alternative && (
            <section aria-labelledby="alt-title" className="flex flex-col gap-2 rounded-[1.25rem] border border-dashed p-5 text-sm">
              <h2 id="alt-title" className={LABEL}>
                {t.task.alternative}
              </h2>
              <p>
                {page.alternative.label}: {page.alternative.options.join(" / ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.provisional}: {page.alternative.chosen}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function EstimatedTag({ t }: { t: PlanTexts }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-dashed border-muted-foreground px-2 text-[11px] text-muted-foreground">
      {t.estimated}
    </span>
  );
}

/** Círculo de quién hace el paso: persona (tú), chispa (IA), edificio (tercero). Decorativo: el texto lo dice. */
function WhoIcon({ actor, dashed = false, small = false }: { actor: PlanStepView["actor"]; dashed?: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "z-10 flex shrink-0 items-center justify-center rounded-full border-2 bg-background",
        small ? "size-6" : "size-10",
        actor === "user" && "border-foreground/70 text-foreground",
        actor === "ai" && "border-accent text-accent",
        actor === "third_party" && "border-info text-info",
        dashed && "border-dashed",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={small ? "size-3.5" : "size-5"}
      >
        {actor === "user" && (
          <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
          </>
        )}
        {actor === "ai" && <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />}
        {actor === "third_party" && <path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5" />}
      </svg>
    </span>
  );
}

/** Datos del paso actual en tres casillas. Todo viene del catálogo: siempre estimado. */
function StepFacts({ step, t, language }: { step: PlanStepView; t: PlanTexts; language: Language }) {
  const facts = [
    { label: t.task.yourTime, value: formatRange(step.effort, "h", language) },
    { label: t.task.cost, value: step.cost ? formatRange(step.cost, "€", language) : "—" },
    { label: t.task.waitLabel, value: step.wait ? formatRange(step.wait, t.task.days, language) : "—" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col gap-1 rounded-lg bg-background p-3">
          <p className={LABEL}>{fact.label}</p>
          <p className="font-bold">{fact.value}</p>
          {fact.value !== "—" && (
            <span className="self-start">
              <EstimatedTag t={t} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Chips de un paso plegado: tiempo, coste y espera (si los hay), con una sola marca "estimado". */
function StepChips({ step, t, language }: { step: PlanStepView; t: PlanTexts; language: Language }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={CHIP}>{formatRange(step.effort, "h", language)}</span>
      {step.cost && <span className={CHIP}>{formatRange(step.cost, "€", language)}</span>}
      {step.wait && (
        <span className={CHIP}>
          {t.wait} {formatRange(step.wait, t.task.days, language)}
        </span>
      )}
      <EstimatedTag t={t} />
    </div>
  );
}

function TaskLinkRow({ link, href }: { link: TaskLink; href: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-background">
      {link.done ? (
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground"
        >
          ✓
        </span>
      ) : (
        <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-input" />
      )}
      <span className={link.done ? "text-muted-foreground" : ""}>{link.title}</span>
    </Link>
  );
}