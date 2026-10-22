import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ProjectCardView, ProjectStage } from "@/lib/projects/view";

const STAGE: Record<ProjectStage, { label: string; hint: string | null; className: string }> = {
  retry: {
    label: "Hay que reintentar",
    hint: "No pudimos analizar tu idea. Vuelve a intentarlo.",
    className: "border border-danger text-danger",
  },
  questions: {
    label: "Faltan respuestas",
    hint: "Responde unas preguntas para terminar tu informe.",
    className: "border border-warning text-warning",
  },
  analysis: { label: "Analizando", hint: "Estamos preparando tu informe.", className: "bg-muted text-muted-foreground" },
  review: {
    label: "Informe listo",
    hint: "Revisa tu informe y apruébalo para crear el plan.",
    className: "border border-info text-info",
  },
  approved: {
    label: "Informe aprobado",
    hint: "El siguiente paso es crear tu plan.",
    className: "border border-info text-info",
  },
  plan: { label: "Plan en marcha", hint: null, className: "bg-accent text-accent-foreground" },
};

/** Acción principal de cada tarjeta y adónde lleva. */
function primaryAction(project: ProjectCardView) {
  const report = `/informe/${project.reportId}`;
  switch (project.stage) {
    case "plan":
      return { label: "Ver plan", href: `${report}/plan` };
    case "approved":
      return { label: "Crear mi plan", href: `${report}/plan` };
    case "review":
      return { label: "Revisar informe", href: report };
    case "retry":
      return { label: "Reintentar", href: report };
    default:
      return { label: "Continuar", href: report };
  }
}

function updated(iso: string, today: string) {
  const days = Math.round((Date.parse(today) - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Actualizado hoy";
  if (days === 1) return "Actualizado ayer";
  if (days < 7) return `Actualizado hace ${days} días`;
  return `Actualizado el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso))}`;
}

export function ProjectsScreen({ projects, today }: { projects: ProjectCardView[]; today: string }) {
  if (projects.length === 0) return <EmptyProjects />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Mis proyectos</h1>
        {/* ?nueva: la portada no te devuelve aquí. */}
        <Link href="/?nueva" className={buttonStyles("accent", "min-h-11")}>
          Nueva idea
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {projects.map((project, index) => {
          const stage = STAGE[project.stage];
          const action = primaryAction(project);
          const pct = project.plan && project.plan.total > 0 ? (project.plan.done / project.plan.total) * 100 : 0;
          return (
            <li
              key={project.reportId}
              className="rise flex flex-col gap-3 rounded-[1.25rem] bg-surface p-5 shadow-soft"
              style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{project.title}</h2>
                  <p className="text-sm text-muted-foreground">{updated(project.updatedAt, today)}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", stage.className)}>
                  {stage.label}
                </span>
              </div>

              {project.plan ? (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label="Progreso del plan"
                      aria-valuemin={0}
                      aria-valuemax={project.plan.total}
                      aria-valuenow={project.plan.done}
                    >
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs">
                      {project.plan.done} de {project.plan.total} tareas
                    </span>
                  </div>
                  {project.plan.opening && (
                    <p>
                      Abres: semanas {project.plan.opening.from}–{project.plan.opening.to}{" "}
                      <span className="rounded-full border border-dashed border-muted-foreground px-2 text-[11px]">estimado</span>
                    </p>
                  )}
                  {project.plan.now && <p>Ahora: {project.plan.now}</p>}
                </div>
              ) : (
                stage.hint && <p className="text-sm text-muted-foreground">{stage.hint}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Link href={action.href} className={buttonStyles("primary", "min-h-11")}>
                  {action.label}
                </Link>
                {(project.stage === "plan" || project.stage === "approved") && (
                  <Link href={`/informe/${project.reportId}`} className={buttonStyles("secondary", "min-h-11")}>
                    Ver informe
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EmptyProjects() {
  return (
    <div className="rise flex flex-col items-center gap-4 rounded-[1.5rem] bg-surface px-6 py-12 text-center shadow-soft">
      <h1 className="text-2xl font-semibold">Empieza con tu primera idea</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Cuéntanos qué quieres montar y te preparamos un informe y un plan.
      </p>
      <Link href="/" className={buttonStyles("accent", "min-h-11")}>
        Escribir mi idea
      </Link>
    </div>
  );
}