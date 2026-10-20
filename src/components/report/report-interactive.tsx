"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  approveReport,
  improveArea,
  reopenReport,
  type ApproveState,
  type ImproveState,
} from "@/app/actions/report";
import type { AreaKey } from "@/lib/report/areas";
import { reportTexts, type ReportTexts } from "@/lib/report/i18n";
import type { AreaCard, ReportView } from "@/lib/report/view";
import { Button, buttonStyles } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { VerdictIcon, VerdictLabel } from "@/components/ui/verdict-icon";
import { cn } from "@/lib/cn";
import { SummaryDialog } from "./summary-dialog";

// Mismo corte que md: de Tailwind (768px).
const MOBILE_QUERY = "(max-width: 767px)";
const cardButtonId = (area: AreaKey) => `card-${area}`;
const SECTION_LABEL = "text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const ESTIMATED_TAG = "rounded-full border border-dashed border-muted-foreground px-2 text-xs text-muted-foreground";

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
  const [selected, setSelected] = useState<AreaKey | null>(initialArea);
  const isMobile = useIsMobile();
  const panelId = useId();
  const summaryRef = useRef<HTMLDialogElement>(null);

  const toggle = (area: AreaKey) => setSelected((current) => (current === area ? null : area));
  // Abre un área y lleva el foco a su tarjeta (el navegador la hace visible).
  const focusArea = (area: AreaKey) => {
    setSelected(area);
    requestAnimationFrame(() => document.getElementById(cardButtonId(area))?.focus());
  };
  const panel = <DetailPanel id={panelId} view={view} reportId={reportId} selected={selected} t={t} />;

  return (
    // pb-28: la barra de acciones fija no tapa lo último.
    <div className="flex flex-col gap-8 pb-28">
      <ReportHeader view={view} reportId={reportId} t={t} onOpenSummary={() => summaryRef.current?.showModal()} />
      <SummaryDialog view={view} reportId={reportId} t={t} dialogRef={summaryRef} autoOpen={initialArea === null} />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-labelledby="assessment" className="flex flex-col gap-3">
          <h2 id="assessment" className={SECTION_LABEL}>
            {t.assessmentByArea}
          </h2>

          <ul className="grid gap-2 sm:grid-cols-2">
            {view.areas.map((card) => {
              const expanded = selected === card.area;
              return [
                <li
                  key={card.area}
                  className={cn("rounded-[1rem] bg-surface shadow-soft transition-shadow", expanded && "ring-2 ring-accent")}
                >
                  <h3>
                    <CardButton
                      id={cardButtonId(card.area)}
                      expanded={expanded}
                      controls={panelId}
                      onClick={() => toggle(card.area)}
                    >
                      <VerdictIcon verdict={card.verdict} />
                      <span className="flex-1">{t.area[card.area]}</span>
                      <VerdictLabel verdict={card.verdict}>{t.verdict[card.verdict]}</VerdictLabel>
                    </CardButton>
                  </h3>
                  <p className="line-clamp-2 px-4 pb-4 pl-[50px] text-sm text-muted-foreground">{card.sentence}</p>
                </li>,
                // En móvil, el panel va justo debajo de la tarjeta abierta.
                isMobile && expanded && (
                  <li key={`${card.area}-panel`} className="rounded-[1rem] bg-surface p-5 shadow-soft sm:col-span-2">
                    {panel}
                  </li>
                ),
              ];
            })}
          </ul>

          <p className="text-sm text-muted-foreground">{t.disclaimer}</p>
        </section>

        {!isMobile && (
          <aside className="min-h-60 self-start overflow-y-auto rounded-[1.25rem] bg-surface p-6 shadow-soft md:sticky md:top-20 md:max-h-[calc(100vh-11rem)]">
            {panel}
          </aside>
        )}
      </div>

      <ActionBar view={view} reportId={reportId} t={t} onFocusArea={focusArea} />
    </div>
  );
}

function ReportHeader({
  view,
  reportId,
  t,
  onOpenSummary,
}: {
  view: ReportView;
  reportId: string;
  t: ReportTexts;
  onOpenSummary: () => void;
}) {
  const count = (verdict: AreaCard["verdict"]) => view.areas.filter((a) => a.verdict === verdict).length;
  const strong = count("strong");
  const risk = count("risk");
  const unknown = count("needs_info");

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t.title}</span>
          <span className="text-4xl font-bold tracking-tighter [overflow-wrap:anywhere]">{view.idea}</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" className="min-h-11" onClick={onOpenSummary}>
            {t.summary.open}
          </Button>
          {/* Sin función todavía: aria-disabled (no disabled) para que teclado y lector lleguen y lean "Próximamente". */}
          <button
            type="button"
            aria-disabled="true"
            className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-md border px-4 text-sm font-medium text-muted-foreground"
          >
            {t.summary.generate}
            <span className="rounded-full bg-muted px-2 text-[11px]">{t.summary.soon}</span>
          </button>
          {/* Aprobado = solo lectura. */}
          {!view.approved && (
            <Link href={`/informe/${reportId}/editar`} className={buttonStyles("secondary", "min-h-11")}>
              {t.editData}
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[1.25rem] bg-surface p-5 shadow-soft">
        <div aria-hidden="true" className="flex h-2.5 gap-1 overflow-hidden rounded-full">
          <span className="bg-success" style={{ flex: strong }} />
          <span className="bg-danger" style={{ flex: risk }} />
          <span className="bg-muted-foreground/40" style={{ flex: unknown }} />
        </div>
        <p className="text-sm text-muted-foreground">{t.summary.counts(strong, risk, unknown)}</p>
      </div>

      {view.contradictions.length > 0 && (
        <section
          aria-labelledby="contradictions"
          className="flex items-start gap-3 rounded-[1.25rem] border border-danger/50 bg-danger/10 p-5"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-danger text-xs font-bold text-danger-foreground"
          >
            !
          </span>
          <div className="flex flex-col gap-1 text-sm">
            <h2 id="contradictions" className="font-semibold">
              {t.contradictionsTitle}
            </h2>
            <ul className="flex flex-col gap-1">
              {view.contradictions.map((c) => (
                <li key={c.id}>
                  {t.contradiction[c.id]} {c.estimated && <span className="text-muted-foreground">{t.includesEstimate}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </header>
  );
}

const ACTION_INITIAL: ApproveState = { error: null };

/** Barra fija abajo: las acciones del informe siempre a mano. */
function ActionBar({
  view,
  reportId,
  t,
  onFocusArea,
}: {
  view: ReportView;
  reportId: string;
  t: ReportTexts;
  onFocusArea: (area: AreaKey) => void;
}) {
  const approve = useMemo(() => approveReport.bind(null, reportId), [reportId]);
  const reopen = useMemo(() => reopenReport.bind(null, reportId), [reportId]);
  const [approveState, approveAction, approving] = useActionState(approve, ACTION_INITIAL);
  const [reopenState, reopenAction, reopening] = useActionState(reopen, ACTION_INITIAL);
  const error = approveState.error ?? reopenState.error;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {view.approved && (
            <p role="status" className="mr-auto flex items-center gap-2 font-semibold text-success">
              <span aria-hidden="true">✓</span>
              {t.approved}
            </p>
          )}

          <Link href="/" className={buttonStyles("secondary", "min-h-11")}>
            {t.startOver}
          </Link>

          {view.approved ? (
            <>
              <form action={reopenAction}>
                <Button type="submit" variant="secondary" disabled={reopening} className="min-h-11 w-full">
                  {t.reopen}
                </Button>
              </form>
              <Link href={`/informe/${reportId}/plan`} className={buttonStyles("accent", "min-h-11")}>
                {t.plan} <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <>
              {view.footer === "contradictions" && (
                <Link href={`/informe/${reportId}/editar`} className={buttonStyles("accent", "min-h-11")}>
                  {t.footer.contradictions}
                </Link>
              )}

              {(view.footer === "risks" || view.footer === "missing_data") && (
                <>
                  <form action={approveAction}>
                    <Button type="submit" variant="secondary" disabled={approving} className="min-h-11 w-full">
                      {t.continueAnyway}
                    </Button>
                  </form>
                  <Button
                    variant="accent"
                    className="min-h-11"
                    onClick={() => view.focusArea && onFocusArea(view.focusArea)}
                  >
                    {t.footer[view.footer]}
                  </Button>
                </>
              )}

              {view.footer === "all_good" && (
                <form action={approveAction}>
                  <Button type="submit" variant="accent" disabled={approving} className="min-h-11 w-full">
                    {t.footer.all_good}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>

        <p aria-live="polite" className="text-sm text-danger empty:hidden sm:text-right">
          {error ? t.approveError[error] : null}
        </p>
      </div>
    </div>
  );
}

function CardButton({
  id,
  expanded,
  controls,
  onClick,
  children,
}: {
  id?: string;
  expanded: boolean;
  controls: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-expanded={expanded}
      // Solo apunta al panel cuando existe: en móvil no se pinta hasta que la tarjeta se abre.
      aria-controls={expanded ? controls : undefined}
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-2.5 rounded-[1rem] px-4 py-3 text-left text-base font-semibold"
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
  selected: AreaKey | null;
  t: ReportTexts;
}) {
  return (
    <div id={id} aria-live="polite" className="flex flex-col gap-5">
      {selected === null ? (
        <p className="text-sm text-muted-foreground">{t.panelHelp}</p>
      ) : (
        <AreaDetail
          card={view.areas.find((a) => a.area === selected)}
          reportId={reportId}
          readOnly={view.approved}
          t={t}
        />
      )}
    </div>
  );
}

function AreaDetail({
  card,
  reportId,
  readOnly,
  t,
}: {
  card: AreaCard | undefined;
  reportId: string;
  readOnly: boolean;
  t: ReportTexts;
}) {
  if (!card) return null;
  return (
    <>
      <div className="flex items-center gap-2.5">
        <VerdictIcon verdict={card.verdict} />
        <p className="flex-1 text-xl font-bold tracking-tight">{t.area[card.area]}</p>
        <VerdictLabel verdict={card.verdict}>{t.verdict[card.verdict]}</VerdictLabel>
      </div>

      <p className={cn("text-base", card.verdict === "needs_info" && "italic text-muted-foreground")}>{card.sentence}</p>

      {card.data.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className={SECTION_LABEL}>{t.dataTitle}</p>
          <dl className="flex flex-col divide-y divide-border rounded-lg bg-background text-sm">
            {card.data.map((item) => (
              <div key={item.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="ml-auto">{item.value}</dd>
                <span className={item.estimated ? ESTIMATED_TAG : "rounded-full bg-muted px-2 text-xs"}>
                  {item.estimated ? t.estimated : t.fromYou}
                </span>
              </div>
            ))}
          </dl>
        </div>
      )}

      {card.pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className={SECTION_LABEL}>{t.pendingTitle}</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {card.pending.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full border border-muted-foreground" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.estimated ? (
        <div className="flex flex-col gap-2 text-sm">
          <span className={cn("self-start", ESTIMATED_TAG)}>{t.estimated}</span>
          {card.assumptions.length > 0 && (
            <details className="rounded-lg bg-background px-3">
              <summary className="flex min-h-11 cursor-pointer items-center gap-1 font-medium">
                <span>{t.assumptions}</span>
                <span className="text-muted-foreground">({card.assumptions.length})</span>
              </summary>
              <ul className="list-disc pb-3 pl-5 text-muted-foreground">
                {card.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.noEstimates}</p>
      )}

      {/* Aprobado = solo lectura. key por área: al cambiar de tarjeta, el formulario empieza cerrado. */}
      {!readOnly && <ImproveSection key={card.area} card={card} reportId={reportId} t={t} />}
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
        className="inline-flex min-h-11 items-center justify-center self-start rounded-full border border-accent px-4 text-sm font-semibold text-accent hover:bg-accent/10"
      >
        {t.improveArea(card.questions.length)}
      </button>

      {open && (
        <form id={formId} action={formAction} className="flex flex-col gap-4 rounded-lg bg-background p-4">
          {card.questions.map((question) => (
            <ChoiceGroup key={question.key} name={question.key} legend={question.prompt} options={question.options} required />
          ))}
          <Button type="submit" variant="accent" disabled={pending} className="min-h-11 self-end">
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