import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnReport } from "@/lib/report/repository";
import { currentBudget, editFields } from "@/lib/report/edit";
import { PageContainer } from "@/components/ui/page-container";
import { EditForm } from "@/components/report/edit-form";

export const metadata: Metadata = { title: "Editar informe" };

export default function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageContainer size="md">
      {/* Sin generateStaticParams, params es dato de la petición: va dentro de Suspense (cacheComponents). */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        {params.then(({ id }) => (
          <EditContent id={id} />
        ))}
      </Suspense>
    </PageContainer>
  );
}

async function EditContent({ id }: { id: string }) {
  const user = await requireUser();
  const report = await getOwnReport(user.id, id);
  // Si no existe o es de otro usuario, la misma respuesta: no se revela que exista.
  if (!report) notFound();
  // Solo se edita un informe terminado.
  if (report.status !== "review") redirect(`/informe/${report.id}`);

  return (
    <EditForm
      reportId={report.id}
      language={report.narrative?.language ?? "en"}
      fields={editFields(report.facts)}
      budget={currentBudget(report.facts)}
    />
  );
}