import Link from "next/link";
import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import type { Department } from "@/lib/plan/line";
import { metroLayout } from "@/lib/plan/metro";
import type { DoneTaskView, PlanTaskView, PlanView } from "@/lib/plan/view";
import { cn } from "@/lib/cn";
import { ConfigForm } from "./config-form";
import { MetroMap, type MetroTask } from "./metro-map";
import { PlanViews } from "./plan-views";
import { TimelineChart } from "./timeline-chart";
import { timelineLayout } from "@/lib/plan/timeline-chart";
import { areasLayout } from "@/lib/plan/areas";
import { AreasMap } from "./areas-map";
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
  success: { dot: "bg-success", label: "text-success" },
  warning: { dot: "bg-warning", label: "text-warning" },
  danger: { dot: "bg-danger", label: "text-danger" },
} as const;

export function PlanScreen({ view, t, reportId, version }: { view: PlanView; t: PlanTexts; reportId: string; version: number }) {
  const { language } = view;
  const all: (PlanTaskView | DoneTaskView)[] = view.phases.flatMap((p) => [...p.tasks, ...p.done]);
  const byId = new Map(all.map((task) => [task.id, task]));
  const doneCount = view.phases.reduce((sum, p) => sum + p.done.length, 0);
  const taskHref = (id: string) => `/informe/${reportId}/plan/tarea/${encodeURIComponent(id)}`;
  const initialTaskId = view.now[0]?.taskId ?? null;
  // La página ya se pinta en cada petición (sesión y plan): "hoy" es el día de la petición.
  const today = new Date().toISOString().slice(0, 10);

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
      {/* El título se ve en el header ("Mando / Plan"); aquí queda para lectores de pantalla y la estructura. */}
      <h1 className="sr-only">{t.title}</h1>

      <section className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_1.6fr]">
        <div className="hud flex flex-col gap-3 rounded-[1.25rem] bg-surface p-6 shadow-soft">
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

          {(view.money || view.deadline) && (
            <div className="mt-auto flex flex-col gap-2 border-t pt-4 text-sm">
              {view.money && <StatusLine tone={MONEY_TONE[view.money]} label={t.overview.money} text={t.money[view.money]} />}
              {view.deadline && (
                <StatusLine tone={DEADLINE_TONE[view.deadline]} label={t.overview.deadline} text={t.deadline[view.deadline]} />
              )}
            </div>
          )}
        </div>

        <section aria-labelledby="now" className="flex flex-col gap-3 rounded-[1.25rem] bg-surface p-5 shadow-soft">
          <h2 id="now" className={cn(LABEL, "text-muted-foreground")}>
            {t.now}
          </h2>
          {view.now.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.nowEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {view.now.map((item) => {
                const task = byId.get(item.taskId);
                const color = deptColor(task?.department ?? null);
                const pct = task && task.progress.total > 0 ? (task.progress.done / task.progress.total) * 100 : 0;
                return (
                  <li
                    key={item.taskId}
                    className="flex items-center gap-4 rounded-[1rem] bg-background px-4 py-3"
                    style={{ boxShadow: `inset 3px 0 0 ${color}` }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {task?.department && (
                        <p className={LABEL} style={{ color }}>
                          {t.department[task.department]}
                        </p>
                      )}
                      <Link href={taskHref(item.taskId)} className="truncate font-semibold underline-offset-4 hover:underline">
                        {item.title}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        {item.step
                          ? `${t.nextStep}: ${item.step.text}`
                          : item.waitingFor
                            ? `${t.waitingFor} ${t.thirdParty[item.waitingFor]}`
                            : null}
                      </p>
                    </div>
                    {task && (
                      <div className="hidden w-28 shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        {task.progress.done}/{task.progress.total}
                      </div>
                    )}
                    {item.step && (
                      <div className="shrink-0">
                        <StepActions reportId={reportId} taskId={item.taskId} version={version} step={item.step} t={t} only="primary" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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

      <PlanViews
        t={t}
        phases={
          <MetroMap
            layout={metroLayout(view)}
            lines={view.lines}
            tasks={metroTasks}
            t={t}
            reportId={reportId}
            initialTaskId={initialTaskId}
          />
        }
        areas={
          <AreasMap
            layout={areasLayout(view)}
            lines={view.lines}
            tasks={metroTasks}
            t={t}
            reportId={reportId}
            initialTaskId={initialTaskId}
          />
        }
        timeline={
          <TimelineChart
            layout={timelineLayout(view, today)}
            lines={view.lines}
            tasks={metroTasks}
            t={t}
            reportId={reportId}
            initialTaskId={initialTaskId}
          />
        }
      />

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

/** Aviso de dinero o fecha límite: punto de color, etiqueta y frase. */
function StatusLine({ tone, label, text }: { tone: keyof typeof TONE_CLASS; label: string; text: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", TONE_CLASS[tone].dot)} />
      <span className={cn(LABEL, TONE_CLASS[tone].label)}>{label}</span>
      <span>{text}</span>
    </p>
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