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

export const metadata: Metadata = { title: "Tu informe" };

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageContainer size="md">
      {/* Sin generateStaticParams, params es dato de la petición: va dentro de Suspense (cacheComponents). */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        {params.then(({ id }) => (
          <ReportContent id={id} />
        ))}
      </Suspense>
    </PageContainer>
  );
}

async function ReportContent({ id }: { id: string }) {
  const user = await requireUser();
  const report = await getOwnReport(user.id, id);
  // Si no existe o es de otro usuario, la misma respuesta: no se revela que exista.
  if (!report) notFound();

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
          index={step.index}
          total={step.total}
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