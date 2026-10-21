import Link from "next/link";
import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import type { Department } from "@/lib/plan/line";
import { metroLayout } from "@/lib/plan/metro";
import type { DoneTaskView, PlanTaskView, PlanView } from "@/lib/plan/view";
import { cn } from "@/lib/cn";
import { ConfigForm } from "./config-form";
import { MetroMap, type MetroTask } from "./metro-map";
import { StepActions } from "./step-actions";

const LABEL = "font-mono text-[10px] uppercase tracking-[0.14em]";
const deptColor = (department: Department | null) => (department ? `var(--dept-${department})` : "var(--muted-foreground)");

function formatDate(iso: string, language: PlanView["language"]) {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

// Tono de cada aviso: verde si va bien, ámbar si hay riesgo, rojo si no llega.
const MONEY_TONE = { fits: "success", at_risk: "warning", over: "danger" } as const;
const DEADLINE_TONE = { on_track: "success", at_risk: "warning", late: "danger" } as const;
const TONE_CLASS = {
  success: { card: "border-success/40 bg-success/5", label: "text-success" },
  warning: { card: "border-warning/40 bg-warning/5", label: "text-warning" },
  danger: { card: "border-danger/40 bg-danger/5", label: "text-danger" },
} as const;

export function PlanScreen({ view, t, reportId, version }: { view: PlanView; t: PlanTexts; reportId: string; version: number }) {
  const { language } = view;
  const all: (PlanTaskView | DoneTaskView)[] = view.phases.flatMap((p) => [...p.tasks, ...p.done]);
  const byId = new Map(all.map((task) => [task.id, task]));
  const doneCount = view.phases.reduce((sum, p) => sum + p.done.length, 0);
  const taskHref = (id: string) => `/informe/${reportId}/plan/tarea/${encodeURIComponent(id)}`;

  const metroTasks: MetroTask[] = all.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    progress: task.progress,
    line: task.line,
    dependsOn: task.dependsOn,
    weeks: "weeks" in task ? task.weeks : null,
    estimated: "estimated" in task ? task.estimated : false,
  }));

  return (
    <div lang={language} className="flex flex-col gap-8 pb-16">
      <h1 className="text-4xl font-bold tracking-tighter">{t.title}</h1>

      <section className="grid gap-4 md:grid-cols-[1.3fr_1fr_1fr]">
        <div className="hud flex flex-col gap-2 rounded-[1.25rem] bg-surface p-6 shadow-soft">
          {view.opening ? (
            <>
              <p className="flex flex-col gap-1">
                <span className={cn(LABEL, "text-muted-foreground")}>{t.opening}:</span>{" "}
                <span className="text-5xl font-bold tracking-tighter">
                  {t.weeks} {view.opening.weeks.from}–{view.opening.weeks.to}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(view.opening.dates.from, language)} – {formatDate(view.opening.dates.to, language)}{" "}
                <span className="rounded-full border border-dashed border-muted-foreground px-2 text-[11px]">{t.estimated}</span>
              </p>
            </>
          ) : null}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${all.length ? (doneCount / all.length) * 100 : 0}%` }} />
            </div>
            {fillText(t.overview.tasksDone, { done: doneCount, total: all.length })}
          </div>
        </div>

        {view.money && (
          <StatusCard tone={MONEY_TONE[view.money]} label={t.overview.money} text={t.money[view.money]} />
        )}
        {view.deadline && (
          <StatusCard tone={DEADLINE_TONE[view.deadline]} label={t.overview.deadline} text={t.deadline[view.deadline]} />
        )}
      </section>

      <section aria-labelledby="now" className="flex flex-col gap-3">
        <h2 id="now" className={cn(LABEL, "text-muted-foreground")}>
          {t.now}
        </h2>
        {view.now.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.nowEmpty}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {view.now.map((item) => {
              const task = byId.get(item.taskId);
              const color = deptColor(task?.department ?? null);
              return (
                <li
                  key={item.taskId}
                  className="flex flex-col gap-2 rounded-[1.25rem] bg-surface p-5"
                  style={{ boxShadow: `inset 3px 0 0 ${color}, var(--elevation)` }}
                >
                  {task?.department && (
                    <p className={LABEL} style={{ color }}>
                      {t.department[task.department]}
                    </p>
                  )}
                  <Link href={taskHref(item.taskId)} className="font-semibold underline-offset-4 hover:underline">
                    {item.title}
                  </Link>
                  {item.step ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t.nextStep}: {item.step.text}
                      </p>
                      <StepActions reportId={reportId} taskId={item.taskId} version={version} step={item.step} t={t} />
                    </>
                  ) : item.waitingFor ? (
                    <p className="text-sm text-muted-foreground">
                      {t.waitingFor} {t.thirdParty[item.waitingFor]}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {view.decisions.length > 0 && (
        <section aria-labelledby="decisions" className="flex flex-col gap-3">
          <h2 id="decisions" className={cn(LABEL, "text-muted-foreground")}>
            {t.decisions}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {view.decisions.map((d) => (
              <li key={d.label} className="flex flex-col gap-1 rounded-[1.25rem] border border-dashed p-5 text-sm">
                <p className="font-semibold">{d.label}</p>
                <p className="text-muted-foreground">{d.options.join(" / ")}</p>
                <p className="text-xs text-muted-foreground">
                  {t.provisional}: <span className="text-foreground">{d.chosen}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label={t.overview.viewsLabel} className="flex flex-wrap gap-1 self-start rounded-full bg-surface p-1 text-sm font-semibold">
        <span aria-current="page" className="rounded-full bg-accent px-4 py-2 text-accent-foreground">
          {t.overview.views.phases}
        </span>
        {[t.overview.views.areas, t.overview.views.timeline].map((name) => (
          <span key={name} aria-disabled="true" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-muted-foreground">
            {name}
            <span className="rounded-full bg-muted px-2 text-[10px] font-medium">{t.overview.soon}</span>
          </span>
        ))}
      </nav>

      <section className="hud map-canvas rounded-[1.5rem] border bg-surface/60 p-4">
        <MetroMap
          layout={metroLayout(view)}
          lines={view.lines}
          tasks={metroTasks}
          t={t}
          reportId={reportId}
          initialTaskId={view.now[0]?.taskId ?? null}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {view.phases.map((group) => {
          const tasks = [...group.tasks, ...group.done];
          return (
            <div key={group.phase} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.phase[group.phase]}</h3>
                <span className={cn(LABEL, "text-muted-foreground")}>
                  {group.done.length}/{tasks.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <CompactRow task={task} href={taskHref(task.id)} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <details className="rounded-[1.25rem] bg-surface p-5 shadow-soft">
        <summary className="cursor-pointer font-medium">{t.adjust}</summary>
        <div className="mt-4">
          <ConfigForm reportId={reportId} version={version} values={view.form} t={t} />
        </div>
      </details>
    </div>
  );
}

function StatusCard({ tone, label, text }: { tone: keyof typeof TONE_CLASS; label: string; text: string }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-[1.25rem] border p-6", TONE_CLASS[tone].card)}>
      <p className={cn(LABEL, TONE_CLASS[tone].label)}>{label}</p>
      <p className="text-lg font-semibold">{text}</p>
    </div>
  );
}

/** Fila compacta: franja del área, punto de quién hace el siguiente paso, título y progreso. */
function CompactRow({ task, href }: { task: PlanTaskView | DoneTaskView; href: string }) {
  const done = task.status === "done";
  const color = deptColor(task.department);
  const who =
    task.nextActor === "ai" ? "var(--accent)" : task.nextActor === "third_party" ? "var(--info)" : "var(--foreground)";
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 rounded-[0.75rem] bg-surface px-3 py-2 text-sm hover:ring-1 hover:ring-accent"
      style={{ boxShadow: `inset 3px 0 0 ${color}` }}
    >
      <span
        aria-hidden="true"
        className={cn("size-2.5 shrink-0 rounded-full", task.status === "waiting" && "border-dashed")}
        style={done ? { background: color } : { border: `2px solid ${who}` }}
      />
      <span className={cn("flex-1", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>{task.title}</span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {done ? "✓" : `${task.progress.done}/${task.progress.total}`}
      </span>
    </Link>
  );
}