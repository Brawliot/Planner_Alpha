import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnReport } from "@/lib/report/repository";
import { PageContainer } from "@/components/ui/page-container";

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
      <p className="text-sm text-muted-foreground">Estamos preparando unas preguntas para entenderla mejor.</p>
    </>
  );
}