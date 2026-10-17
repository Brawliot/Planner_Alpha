import Link from "next/link";
import { reportTexts } from "@/lib/report/i18n";
import type { ReportView } from "@/lib/report/view";
import { Button, buttonStyles } from "@/components/ui/button";
import { VerdictIcon, VerdictLabel } from "@/components/ui/verdict-icon";

const LEGEND = ["strong", "watch", "risk", "needs_info"] as const;

/** Informe (servidor). Solo recibe la vista ya preparada: nunca datos internos. */
export function ReportScreen({ view }: { view: ReportView }) {
  const t = reportTexts(view.language);

  return (
    <div lang={view.language} className="mx-auto grid w-full max-w-[960px] gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold leading-tight">{t.title}</h1>

          <section aria-labelledby="your-idea" className="rounded-lg border p-4">
            <h2 id="your-idea" className="text-base font-semibold">
              {t.yourIdea}
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words italic">{view.idea}</p>
          </section>

          <section aria-labelledby="assessment" className="flex flex-col gap-3">
            <h2 id="assessment" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t.assessmentByArea}
            </h2>

            <div>
              <p className="sr-only">{t.verdicts}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {LEGEND.map((verdict) => (
                  <li key={verdict} className="flex items-center gap-2">
                    <VerdictIcon verdict={verdict} />
                    {t.verdict[verdict]}
                  </li>
                ))}
              </ul>
            </div>

            <ul className="flex flex-col gap-2">
              {view.areas.map((card) => (
                <li key={card.area} className="rounded-lg border px-3.5 py-2.5">
                  <h3 className="flex min-h-8 items-center gap-2.5 text-base font-semibold">
                    <VerdictIcon verdict={card.verdict} />
                    <span className="flex-1">{t.area[card.area]}</span>
                    <VerdictLabel verdict={card.verdict}>{t.verdict[card.verdict]}</VerdictLabel>
                  </h3>
                  <p className="mt-1 truncate pl-[34px] text-sm text-muted-foreground">{card.sentence}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="main-risks" className="rounded-lg border p-4">
            <h2 id="main-risks" className="flex items-center justify-between gap-2 text-base font-semibold">
              {t.mainRisks}
              {view.risks.length > 0 && <span className="text-sm font-normal text-muted-foreground">{t.riskCount(view.risks.length)}</span>}
            </h2>
            {view.risks.length > 0 ? (
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
                {view.risks.map((risk) => (
                  <li key={risk.area}>
                    <span className="font-semibold">{t.area[risk.area]}:</span> {risk.sentence}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t.noRisks}</p>
            )}
          </section>

          <p className="text-sm text-muted-foreground">{t.disclaimer}</p>
        </div>

        <aside aria-live="polite" className="min-h-60 rounded-lg border p-5 md:sticky md:top-4 md:self-start">
          <p className="text-sm text-muted-foreground">{t.panelHelp}</p>
        </aside>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href="/" className={buttonStyles("secondary", "min-h-11")}>
          {t.startOver}
        </Link>
        {/* Sin destino hasta el paso 13 (editar y aprobar). */}
        <Button disabled className="min-h-11">
          {t.footer[view.footer]}
        </Button>
      </div>
    </div>
  );
}