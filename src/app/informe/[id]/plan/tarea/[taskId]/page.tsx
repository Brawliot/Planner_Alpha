import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnReport } from "@/lib/report/repository";
import { MOLDS } from "@/lib/plan/catalog";
import { PLAN_TEXTS } from "@/lib/plan/i18n";
import { planInput } from "@/lib/plan/input";
import { rebuildPlan } from "@/lib/plan/orchestrator";
import { getOwnPlanByReport } from "@/lib/plan/repository";
import { taskPageView } from "@/lib/plan/task-view";
import { planView } from "@/lib/plan/view";
import { PageContainer } from "@/components/ui/page-container";
import { TaskPage } from "@/components/plan/task-page";

export const metadata: Metadata = { title: "Tarea" };

export default function TaskRoute({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  return (
    <PageContainer size="lg">
      {/* Sin generateStaticParams, params es dato de la petición: va dentro de Suspense (cacheComponents). */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        {params.then(({ id, taskId }) => (
          <TaskContent id={id} taskId={taskId} />
        ))}
      </Suspense>
    </PageContainer>
  );
}

async function TaskContent({ id, taskId }: { id: string; taskId: string }) {
  const user = await requireUser();
  const report = await getOwnReport(user.id, id);
  // Si no existe o es de otro usuario, la misma respuesta: no se revela que exista.
  if (!report) notFound();
  const plan = await getOwnPlanByReport(user.id, report.id);
  if (!plan) notFound();

  const input = planInput(report);
  const t = PLAN_TEXTS[input.language];
  const today = new Date().toISOString().slice(0, 10);
  const state = rebuildPlan({ report: input, config: plan.config, catalog: MOLDS, stored: plan.stored, today });
  const view = planView({ state, config: plan.config, catalog: MOLDS, facts: report.facts, language: input.language });
  const page = taskPageView(view, state, taskId);
  if (!page) notFound();

  return <TaskPage page={page} t={t} reportId={report.id} version={plan.version} />;
}