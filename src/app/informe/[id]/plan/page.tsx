import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnReport } from "@/lib/report/repository";
import { MOLDS } from "@/lib/plan/catalog";
import { PLAN_TEXTS } from "@/lib/plan/i18n";
import { planInput } from "@/lib/plan/input";
import { rebuildPlan } from "@/lib/plan/orchestrator";
import { getOwnPlanByReport } from "@/lib/plan/repository";
import { planView } from "@/lib/plan/view";
import { buttonStyles } from "@/components/ui/button";
import { CreatePlanForm } from "@/components/plan/create-plan-form";
import { PlanScreen } from "@/components/plan/plan-screen";

export const metadata: Metadata = { title: "Tu plan" };

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    // A todo el ancho: el plan es un lienzo de borde a borde (sin el contenedor con márgenes de otras páginas).
    <main id="contenido" tabIndex={-1} className="flex w-full flex-1 flex-col outline-none">
      {/* Sin generateStaticParams, params es dato de la petición: va dentro de Suspense (cacheComponents). */}
      <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando...</p>}>
        {params.then(({ id }) => (
          <PlanContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function PlanContent({ id }: { id: string }) {
  const user = await requireUser();
  const report = await getOwnReport(user.id, id);
  // Si no existe o es de otro usuario, la misma respuesta: no se revela que exista.
  if (!report) notFound();

  const input = planInput(report);
  const t = PLAN_TEXTS[input.language];
  const plan = await getOwnPlanByReport(user.id, report.id);

  if (!plan) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        {report.status === "approved" ? (
          <>
            <p className="text-sm">{t.createIntro}</p>
            <CreatePlanForm reportId={report.id} label={t.create} pendingLabel={t.creating} />
          </>
        ) : (
          <>
            <p className="text-sm">{t.notApproved}</p>
            <Link href={`/informe/${report.id}`} className={buttonStyles("secondary", "min-h-11 self-start")}>
              {t.backToReport}
            </Link>
          </>
        )}
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const state = rebuildPlan({ report: input, config: plan.config, catalog: MOLDS, stored: plan.stored, today });
  const view = planView({ state, config: plan.config, catalog: MOLDS, facts: report.facts, language: input.language });
  return (
    <>
      {plan.repaired && (
        <p
          role="status"
          className="fixed inset-x-0 top-16 z-50 mx-auto w-fit max-w-[90vw] rounded-md border border-warning bg-background px-3 py-2 text-sm shadow"
        >
          {t.repaired}
        </p>
      )}
      <PlanScreen view={view} t={t} reportId={report.id} version={plan.version} />
    </>
  );
}