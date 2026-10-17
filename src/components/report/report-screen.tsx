import type { AreaKey } from "@/lib/report/areas";
import type { ReportView } from "@/lib/report/view";
import { ReportInteractive } from "./report-interactive";

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
  return (
    <div lang={view.language} className="mx-auto w-full max-w-[960px]">
      <ReportInteractive view={view} reportId={reportId} initialArea={initialArea} />
    </div>
  );
}