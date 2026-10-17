import Link from "next/link";
import { reportTexts } from "@/lib/report/i18n";
import type { ReportView } from "@/lib/report/view";
import { Button, buttonStyles } from "@/components/ui/button";
import { ReportInteractive } from "./report-interactive";
import type { AreaKey } from "@/lib/report/areas";

/** Informe (servidor). Solo pasa la vista ya preparada al componente interactivo: nunca datos internos. */
export function ReportScreen({
  view,
  reportId,
  initialArea,
}: {
  view: ReportView;
  reportId: string;
  initialArea: AreaKey | null;
}) {
  const t = reportTexts(view.language);

  return (
    <div lang={view.language} className="mx-auto grid w-full max-w-[960px] gap-6">
      <ReportInteractive view={view} reportId={reportId} initialArea={initialArea} />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href="/" className={buttonStyles("secondary", "min-h-11")}>
          {t.startOver}
        </Link>
        <Link href={`/informe/${reportId}/editar`} className={buttonStyles("secondary", "min-h-11")}>
          {t.editData}
        </Link>
        {/* Sin destino hasta el paso 13 (editar y aprobar). */}
        <Button disabled className="min-h-11">
          {t.footer[view.footer]}
        </Button>
      </div>
    </div>
  );
}