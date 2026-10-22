"use client";

import Link from "next/link";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { Department } from "@/lib/plan/line";
import type { DoneTaskView, PlanTaskView, PlanView } from "@/lib/plan/view";
import { cn } from "@/lib/cn";
import { ConfigForm } from "./config-form";
import { ActivePanel, type MetroTask } from "./metro-map";
import { StepActions } from "./step-actions";

export type InspectorTab = "now" | "task" | "decisions" | "adjust";

const LABEL = "font-mono text-[10px] uppercase tracking-[0.14em]";
const deptColor = (department: Department | null | undefined) => (department ? `var(--dept-${department})` : "var(--muted-foreground)");
const isOpen = (status: string) => status !== "done" && status !== "skipped";

/** Panel derecho del plan: Ahora · Tarea · Decisiones · Ajustar. Lo que se pulsa en el mapa se ve en "Tarea". */
export function PlanInspector({
  tab,
  onTab,
  view,
  tasks,
  activeId,
  t,
  reportId,
  version,
}: {
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  view: PlanView;
  tasks: MetroTask[];
  /** Tarea que se ve en "Tarea" (la que tiene el ratón encima o la última pulsada). */
  activeId: string | null;
  t: PlanTexts;
  reportId: string;
  version: number;
}) {
  const tabs: { id: InspectorTab; label: string; count?: number }[] = [
    { id: "now", label: t.now, count: view.now.length },
    { id: "task", label: t.overview.tabTask },
    ...(view.decisions.length > 0 ? [{ id: "decisions" as const, label: t.overview.tabDecisions, count: view.decisions.length }] : []),
    { id: "adjust", label: t.adjust },
  ];

  return (
    <aside className="flex min-h-0 flex-col gap-4 rounded-[1.5rem] bg-surface p-4 shadow-soft">
      <div
        role="tablist"
        aria-label={t.overview.inspectorLabel}
        className="grid gap-1 rounded-full bg-background p-1 text-xs font-semibold"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => onTab(item.id)}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1 rounded-full px-2",
              tab === item.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.count ? (
              <span className={cn("rounded-full px-1.5 text-[10px]", tab === item.id ? "bg-accent-foreground/15" : "bg-muted")}>{item.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
        {tab === "now" && <NowTab view={view} t={t} reportId={reportId} version={version} />}
        {tab === "task" && <TaskTab view={view} tasks={tasks} activeId={activeId} t={t} reportId={reportId} version={version} />}
        {tab === "decisions" && <DecisionsTab view={view} t={t} />}
        {tab === "adjust" && <ConfigForm reportId={reportId} version={version} values={view.form} t={t} />}
      </div>
    </aside>
  );
}

function NowTab({ view, t, reportId, version }: { view: PlanView; t: PlanTexts; reportId: string; version: number }) {
  const byId = new Map<string, PlanTaskView | DoneTaskView>(view.phases.flatMap((p) => [...p.tasks, ...p.done]).map((task) => [task.id, task]));

  return (
    <section aria-label={t.now} className="flex flex-col gap-2">
      {view.now.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.nowEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {view.now.map((item) => {
            const task = byId.get(item.taskId);
            const color = deptColor(task?.department);
            const pct = task && task.progress.total > 0 ? (task.progress.done / task.progress.total) * 100 : 0;
            return (
              <li
                key={item.taskId}
                className="flex flex-col gap-2 rounded-[1rem] bg-background p-3"
                style={{ boxShadow: `inset 3px 0 0 ${color}` }}
              >
                <div>
                  {task?.department && (
                    <p className={LABEL} style={{ color }}>
                      {t.department[task.department]}
                    </p>
                  )}
                  <Link
                    href={`/informe/${reportId}/plan/tarea/${encodeURIComponent(item.taskId)}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {item.title}
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.step
                    ? `${t.nextStep}: ${item.step.text}`
                    : item.waitingFor
                      ? `${t.waitingFor} ${t.thirdParty[item.waitingFor]}`
                      : null}
                </p>
                <div className="flex items-center gap-3">
                  {task && (
                    <div className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      {task.progress.done}/{task.progress.total}
                    </div>
                  )}
                  {item.step && (
                    <StepActions reportId={reportId} taskId={item.taskId} version={version} step={item.step} t={t} only="primary" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TaskTab({
  view,
  tasks,
  activeId,
  t,
  reportId,
  version,
}: {
  view: PlanView;
  tasks: MetroTask[];
  activeId: string | null;
  t: PlanTexts;
  reportId: string;
  version: number;
}) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const active = activeId ? byId.get(activeId) : undefined;
  if (!active) return <p className="text-sm text-muted-foreground">{t.overview.pickTask}</p>;

  const full = view.phases.flatMap((p) => [...p.tasks, ...p.done]).find((task) => task.id === active.id);
  const next = full?.steps.find((step) => isOpen(step.status));

  return (
    <div className="flex flex-col gap-3">
      <ActivePanel
        task={active}
        line={view.lines[active.line]}
        before={active.dependsOn.flatMap((id) => byId.get(id) ?? [])}
        unlocks={tasks.filter((task) => task.dependsOn.includes(active.id))}
        t={t}
        reportId={reportId}
      />
      {next && (
        <div className="mt-2 flex flex-col gap-2 border-t pt-4">
          <p className={cn(LABEL, "text-muted-foreground")}>{t.nextStep}</p>
          <p className="text-sm">{next.text}</p>
          <StepActions reportId={reportId} taskId={active.id} version={version} step={next} t={t} emphasis />
        </div>
      )}
    </div>
  );
}

function DecisionsTab({ view, t }: { view: PlanView; t: PlanTexts }) {
  return (
    <ul className="flex flex-col gap-3">
      {view.decisions.map((d) => (
        <li key={d.label} className="flex flex-col gap-1 rounded-[1rem] border border-dashed p-4 text-sm">
          <p className="font-semibold">{d.label}</p>
          <p className="text-muted-foreground">{d.options.join(" / ")}</p>
          <p className="text-xs text-muted-foreground">
            {t.provisional}: <span className="text-foreground">{d.chosen}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}