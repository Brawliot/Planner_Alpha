"use client";

import { useActionState, useId, useMemo, useState, useSyncExternalStore } from "react";
import { improveArea, type ImproveState } from "@/app/actions/report";
import { Button, buttonStyles } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import type { AreaKey } from "@/lib/report/areas";
import { reportTexts, type ReportTexts } from "@/lib/report/i18n";
import type { AreaCard, ReportView } from "@/lib/report/view";
import { VerdictIcon, VerdictLabel } from "@/components/ui/verdict-icon";
import { cn } from "@/lib/cn";

const LEGEND = ["strong", "watch", "risk", "needs_info"] as const;
// Mismo corte que md: de Tailwind (768px).
const MOBILE_QUERY = "(max-width: 767px)";

type Selection = AreaKey | "risks" | null;

/** En el servidor se asume escritorio; en el navegador se lee el ancho real (patrón oficial de React). */
function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(MOBILE_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

export function ReportInteractive({
  view,
  reportId,
  initialArea,
}: {
  view: ReportView;
  reportId: string;
  initialArea: AreaKey | null;
}) {
  const t = reportTexts(view.language);
  // Tras mejorar un área, se vuelve con ella abierta.
  const [selected, setSelected] = useState<Selection>(initialArea);
  const isMobile = useIsMobile();
  const panelId = useId();

  const toggle = (key: Exclude<Selection, null>) => setSelected((current) => (current === key ? null : key));
  const panel = <DetailPanel id={panelId} view={view} reportId={reportId} selected={selected} t={t} />;

  return (
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
            {view.areas.map((card) => {
              const expanded = selected === card.area;
              return [
                <li key={card.area} className={cn("rounded-lg border", expanded && "border-primary")}>
                  <h3>
                    <CardButton expanded={expanded} controls={panelId} onClick={() => toggle(card.area)}>
                      <VerdictIcon verdict={card.verdict} />
                      <span className="flex-1">{t.area[card.area]}</span>
                      <VerdictLabel verdict={card.verdict}>{t.verdict[card.verdict]}</VerdictLabel>
                    </CardButton>
                  </h3>
                  <p className="truncate px-3.5 pb-2.5 pl-[48px] text-sm text-muted-foreground">{card.sentence}</p>
                </li>,
                // En móvil, el panel va justo debajo de la tarjeta abierta.
                isMobile && expanded && (
                  <li key={`${card.area}-panel`} className="rounded-lg border p-5">
                    {panel}
                  </li>
                ),
              ];
            })}
          </ul>
        </section>

        <section aria-labelledby="main-risks" className={cn("rounded-lg border", selected === "risks" && "border-primary")}>
          <h2 id="main-risks">
            <CardButton expanded={selected === "risks"} controls={panelId} onClick={() => toggle("risks")}>
              <span className="flex-1">{t.mainRisks}</span>
              {view.risks.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">{t.riskCount(view.risks.length)}</span>
              )}
            </CardButton>
          </h2>
          {isMobile && selected === "risks" && <div className="border-t p-5">{panel}</div>}
        </section>

        <p className="text-sm text-muted-foreground">{t.disclaimer}</p>
      </div>

      {!isMobile && (
        <aside className="min-h-60 self-start overflow-y-auto rounded-lg border p-5 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)]">
          {panel}
        </aside>
      )}
    </div>
  );
}

function CardButton({
  expanded,
  controls,
  onClick,
  children,
}: {
  expanded: boolean;
  controls: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      // Solo apunta al panel cuando existe: en móvil no se pinta hasta que la tarjeta se abre.
      aria-controls={expanded ? controls : undefined}
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-base font-semibold"
    >
      {children}
      <span
        aria-hidden="true"
        className={cn("text-muted-foreground transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-180")}
      >
        ▾
      </span>
    </button>
  );
}


function DetailPanel({
  id,
  view,
  reportId,
  selected,
  t,
}: {
  id: string;
  view: ReportView;
  reportId: string;
  selected: Selection;
  t: ReportTexts;
}) {
  return (
    <div id={id} aria-live="polite" className="flex flex-col gap-3">
      {selected === null && <p className="text-sm text-muted-foreground">{t.panelHelp}</p>}

      {selected === "risks" && (
        <>
          <p className="text-base font-semibold">{t.mainRisks}</p>
          {view.risks.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {view.risks.map((risk) => (
                <li key={risk.area}>
                  <span className="font-semibold">{t.area[risk.area]}:</span> {risk.sentence}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noRisks}</p>
          )}
        </>
      )}

      {selected !== null && selected !== "risks" && (
        <AreaDetail card={view.areas.find((a) => a.area === selected)} reportId={reportId} t={t} />
      )}
    </div>
  );
}

function AreaDetail({ card, reportId, t }: { card: AreaCard | undefined; reportId: string; t: ReportTexts }) {
  if (!card) return null;
  return (
    <>
      <p className="flex items-center gap-2.5 text-base font-semibold">
        <VerdictIcon verdict={card.verdict} />
        <span className="flex-1">{t.area[card.area]}</span>
        <VerdictLabel verdict={card.verdict}>{t.verdict[card.verdict]}</VerdictLabel>
      </p>

      <p className={cn("text-base", card.verdict === "needs_info" && "italic text-muted-foreground")}>{card.sentence}</p>

      {card.estimated ? (
        <div className="flex flex-col gap-2 text-sm">
          <span className="self-start rounded-full border border-dashed border-muted-foreground px-2 text-xs text-muted-foreground">
            {t.estimated}
          </span>
          {card.assumptions.length > 0 && (
            <div>
              <p className="font-semibold">{t.assumptions}</p>
              <ul className="list-disc pl-5">
                {card.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.noEstimates}</p>
      )}

      {/* key por área: al cambiar de tarjeta, el formulario empieza cerrado y vacío. */}
      <ImproveSection key={card.area} card={card} reportId={reportId} t={t} />
    </>
  );
}

const IMPROVE_INITIAL: ImproveState = { error: null };

function ImproveSection({ card, reportId, t }: { card: AreaCard; reportId: string; t: ReportTexts }) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const action = useMemo(() => improveArea.bind(null, reportId, card.area), [reportId, card.area]);
  const [state, formAction, pending] = useActionState(action, IMPROVE_INITIAL);

  if (card.questions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((value) => !value)}
        className={buttonStyles("secondary", "min-h-9 self-start")}
      >
        {t.improveArea(card.questions.length)}
      </button>

      {open && (
        <form id={formId} action={formAction} className="flex flex-col gap-4 rounded-md border border-dashed bg-muted p-3">
          {card.questions.map((question) => (
            <ChoiceGroup key={question.key} name={question.key} legend={question.prompt} options={question.options} required />
          ))}
          <Button type="submit" disabled={pending} className="self-end">
            {pending ? t.saving : t.save}
          </Button>
          <p aria-live="polite" className="text-sm text-danger">
            {state.error ? t.improveError[state.error] : null}
          </p>
        </form>
      )}
    </div>
  );
}