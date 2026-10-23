import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnReport } from "@/lib/report/repository";
import { answerOptions, currentStep, promptFor } from "@/lib/report/questions";
import { answerQuestions, retryAnalysis, retryClassification } from "@/app/actions/report";
import { PageContainer } from "@/components/ui/page-container";
import { QuestionsForm } from "@/components/report/questions-form";
import { RetryForm } from "@/components/report/retry-form";
import { ReportScreen } from "@/components/report/report-screen";
import { reportView } from "@/lib/report/view";

export const metadata: Metadata = { title: "Tu informe" };

export default function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  return (
    <PageContainer size="lg">
      {/* Sin generateStaticParams, params es dato de la petición: va dentro de Suspense (cacheComponents). */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        {Promise.all([params, searchParams]).then(([{ id }, { area }]) => (
          <ReportContent id={id} area={typeof area === "string" ? area : null} />
        ))}
      </Suspense>
    </PageContainer>
  );
}

async function ReportContent({ id, area }: { id: string; area: string | null }) {
  const user = await requireUser();
  const report = await getOwnReport(user.id, id);
  // Si no existe o es de otro usuario, la misma respuesta: no se revela que exista.
  if (!report) notFound();

  // Con el análisis terminado, el informe. Antes, la idea y el paso en curso (preguntas o reintentar).
  if (report.status === "review" || report.status === "approved") {
    const view = reportView(report.idea, report.facts, report.narrative ?? null, report.status === "approved");
    // Solo se abre si es un área de este informe; cualquier otro valor se ignora.
    const initialArea = view.areas.find((card) => card.area === area)?.area ?? null;
    return <ReportScreen view={view} reportId={report.id} initialArea={initialArea} />;
  }

  // Antes del informe: columna estrecha (modo concentración) con la idea en una tira compacta.
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pt-4 pb-16">
      <IdeaStrip idea={report.idea} />
      <ReportStep report={report} />
    </div>
  );
}

function IdeaStrip({ idea }: { idea: string }) {
  return (
    <div className="rise flex items-start gap-3 rounded-[1rem] bg-surface px-4 py-3 text-sm shadow-soft">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 size-4 shrink-0 text-accent"
      >
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
      </svg>
      <p className="min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap">
        <span className="text-muted-foreground">Tu idea · </span>
        <span>{idea}</span>
      </p>
    </div>
  );
}

type Report = NonNullable<Awaited<ReturnType<typeof getOwnReport>>>;

// Hasta que el informe esté listo, el usuario solo ve preguntas: nunca la clasificación.
function ReportStep({ report }: { report: Report }) {
  switch (report.status) {
    case "new":
      return (
        <>
          <h1 className="sr-only">Tu idea</h1>
          <p className="text-sm">No hemos podido analizar tu idea.</p>
          <RetryForm action={retryClassification.bind(null, report.id)} />
        </>
      );
    case "questions": {
      const step = currentStep(report.facts);
      if (!step) return <p className="text-sm text-muted-foreground">Estamos preparando tu informe.</p>;
      // Al navegador solo llegan las preguntas pendientes de este tema, no lo que ya se sabe.
      return (
        <QuestionsForm
          // Un tema nuevo monta el formulario de nuevo: empieza limpio y recibe el foco.
          key={step.topic}
          action={answerQuestions.bind(null, report.id)}
          topic={step.topic}
          title={step.title}
          from={step.from}
          to={step.to}
          totalQuestions={step.totalQuestions}
          topics={step.topics}
          questions={step.keys.map((key) => ({ key, prompt: promptFor(key), options: answerOptions(key) }))}
        />
      );
    }
    case "analysis":
      return (
        <>
          <h1 className="sr-only">Tu idea</h1>
          <p className="text-sm">No hemos podido completar el análisis de tu idea.</p>
          <RetryForm action={retryAnalysis.bind(null, report.id)} />
        </>
      );
    case "review":
    case "approved":
      return <p className="text-sm text-muted-foreground">Estamos preparando tu informe.</p>;
  }
}