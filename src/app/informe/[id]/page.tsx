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

  return (
    <>
      <h1 className="text-2xl font-semibold">Tu idea</h1>
      <p className="whitespace-pre-wrap break-words">{report.idea}</p>
      <ReportStep report={report} />
    </>
  );
}

type Report = NonNullable<Awaited<ReturnType<typeof getOwnReport>>>;

// Hasta que el informe esté listo, el usuario solo ve preguntas: nunca la clasificación.
function ReportStep({ report }: { report: Report }) {
  switch (report.status) {
    case "new":
      return (
        <>
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
          action={answerQuestions.bind(null, report.id)}
          topic={step.topic}
          title={step.title}
          from={step.from}
          to={step.to}
          totalQuestions={step.totalQuestions}
          questions={step.keys.map((key) => ({ key, prompt: promptFor(key), options: answerOptions(key) }))}
        />
      );
    }
    case "analysis":
      return (
        <>
          <p className="text-sm">No hemos podido completar el análisis de tu idea.</p>
          <RetryForm action={retryAnalysis.bind(null, report.id)} />
        </>
      );
    case "review":
    case "approved":
      return <p className="text-sm text-muted-foreground">Estamos preparando tu informe.</p>;
  }
}