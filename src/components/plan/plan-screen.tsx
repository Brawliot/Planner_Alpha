import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import type { DoneTaskView, PlanTaskView, PlanView } from "@/lib/plan/view";
import { cn } from "@/lib/cn";
import type { MetroTask } from "./metro-map";
import { PlanWorkspace } from "./plan-workspace";

const LABEL = "font-mono text-[10px] uppercase tracking-[0.14em]";

function formatDate(iso: string, language: PlanView["language"]) {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

// Tono de cada aviso: verde si va bien, ámbar si hay riesgo, rojo si no llega.
const MONEY_TONE = { fits: "success", at_risk: "warning", over: "danger" } as const;
const DEADLINE_TONE = { on_track: "success", at_risk: "warning", late: "danger" } as const;
const DOT = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" } as const;

export function PlanScreen({ view, t, reportId, version }: { view: PlanView; t: PlanTexts; reportId: string; version: number }) {
  const { language } = view;
  const all: (PlanTaskView | DoneTaskView)[] = view.phases.flatMap((p) => [...p.tasks, ...p.done]);
  const doneCount = view.phases.reduce((sum, p) => sum + p.done.length, 0);
  // La página ya se pinta en cada petición (sesión y plan): "hoy" es el día de la petición.
  const today = new Date().toISOString().slice(0, 10);

  const tasks: MetroTask[] = all.map((task) => ({
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
    <div lang={language} className="flex flex-col gap-4 pb-6">
      {/* El título se ve en el header ("Mando / Plan"); aquí queda para lectores de pantalla y la estructura. */}
      <h1 className="sr-only">{t.title}</h1>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1">
        {view.opening && (
          <p className="flex flex-wrap items-baseline gap-2">
            <span className={cn(LABEL, "text-muted-foreground")}>{t.opening}:</span>{" "}
            <span className="text-2xl font-bold tracking-tighter">
              {t.weeks} {view.opening.weeks.from}–{view.opening.weeks.to}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatDate(view.opening.dates.from, language)} – {formatDate(view.opening.dates.to, language)}
            </span>
            <span className="rounded-full border border-dashed border-muted-foreground px-2 text-[11px] text-muted-foreground">{t.estimated}</span>
          </p>
        )}
        {view.money && <Status tone={MONEY_TONE[view.money]} text={t.money[view.money]} />}
        {view.deadline && <Status tone={DEADLINE_TONE[view.deadline]} text={t.deadline[view.deadline]} />}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${all.length ? (doneCount / all.length) * 100 : 0}%` }} />
          </span>
          {fillText(t.overview.tasksDone, { done: doneCount, total: all.length })}
        </p>
      </div>

      <PlanWorkspace view={view} tasks={tasks} today={today} t={t} reportId={reportId} version={version} />
    </div>
  );
}

function Status({ tone, text }: { tone: keyof typeof DOT; text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
      {text}
    </p>
  );
}