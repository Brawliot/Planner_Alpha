"use client";

import { Fragment, useActionState, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { retrySummary, type SummaryState } from "@/app/actions/report";
import type { ReportTexts } from "@/lib/report/i18n";
import type { Segment } from "@/lib/report/summary";
import type { ReportView } from "@/lib/report/view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const PARTS = ["strengths", "work", "unknown", "next"] as const;
type Part = (typeof PARTS)[number];

const TONE: Record<Part, { heading: string; tab: string }> = {
  strengths: { heading: "text-success", tab: "aria-selected:bg-success/15 aria-selected:text-success" },
  work: { heading: "text-danger", tab: "aria-selected:bg-danger/15 aria-selected:text-danger" },
  unknown: { heading: "text-muted-foreground", tab: "aria-selected:bg-muted aria-selected:text-foreground" },
  next: { heading: "text-accent", tab: "aria-selected:bg-accent aria-selected:text-accent-foreground" },
};

// "Visto" por informe en este navegador: el resumen se abre solo la primera vez.
const seenKey = (reportId: string) => `mando:resumen-visto:${reportId}`;

function wasSeen(reportId: string) {
  try {
    return window.localStorage.getItem(seenKey(reportId)) !== null;
  } catch {
    // Sin almacenamiento no podemos recordarlo: mejor no abrirlo solo en cada visita.
    return true;
  }
}

function markSeen(reportId: string) {
  try {
    window.localStorage.setItem(seenKey(reportId), "1");
  } catch {
    // Almacenamiento bloqueado: no pasa nada.
  }
}

const RETRY_INITIAL: SummaryState = { error: null };

export function SummaryDialog({
  view,
  reportId,
  t,
  dialogRef,
  autoOpen,
}: {
  view: ReportView;
  reportId: string;
  t: ReportTexts;
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** false al volver de "Mejorar esta área": ahí se quiere ver el área, no el resumen. */
  autoOpen: boolean;
}) {
  const { summary } = view;
  const parts = PARTS.filter((part) => summary?.[part]);
  const [tab, setTab] = useState(0);
  const current = Math.min(tab, Math.max(parts.length - 1, 0));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const retry = useMemo(() => retrySummary.bind(null, reportId), [reportId]);
  const [state, retryAction, retrying] = useActionState(retry, RETRY_INITIAL);
  const hasSummary = summary !== null;

  // Solo la primera vez y solo con resumen: no se recibe al usuario con un error.
  useEffect(() => {
    if (autoOpen && hasSummary && !wasSeen(reportId)) {
      markSeen(reportId);
      dialogRef.current?.showModal();
    }
  }, [autoOpen, hasSummary, reportId, dialogRef]);

  const close = () => dialogRef.current?.close();
  const select = (index: number, focus = false) => {
    setTab(index);
    if (focus) tabRefs.current[index]?.focus();
  };

  const count = (verdict: string) => view.areas.filter((a) => a.verdict === verdict).length;
  const strong = count("strong");
  const risk = count("risk");
  const unknown = count("needs_info");
  const part = parts[current];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      // Al cerrar, la próxima vez empieza por la primera parte.
      onClose={() => setTab(0)}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="modal-enter m-auto w-[min(42rem,calc(100%-2rem))] overflow-hidden rounded-[1.5rem] border bg-surface p-0 text-foreground shadow-soft"
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className="flex flex-col gap-3 border-b px-8 pt-8 pb-6">
          <div className="flex flex-wrap items-center gap-2 pr-10">
            <p className="text-sm font-medium text-muted-foreground">{t.summary.open}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              <span aria-hidden="true">✦</span> {t.summary.aiBadge}
            </span>
          </div>
          <h2 id={`${id}-title`} className="line-clamp-2 pr-10 text-3xl font-bold tracking-tighter [overflow-wrap:anywhere]">
            {view.idea}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div aria-hidden="true" className="flex h-1.5 w-40 gap-0.5 overflow-hidden rounded-full">
              <span className="bg-success" style={{ flex: strong }} />
              <span className="bg-danger" style={{ flex: risk }} />
              <span className="bg-muted-foreground/40" style={{ flex: unknown }} />
            </div>
            {t.summary.counts(strong, risk, unknown)}
          </div>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-8 py-6">
          {summary && part ? (
            <>
              <p className="text-lg leading-snug font-medium">
                <SegmentsText segments={summary.lead} t={t} />
              </p>

              <div
                role="tablist"
                aria-label={t.summary.partsLabel}
                className="grid gap-1 rounded-full bg-background p-1 text-xs font-semibold"
                style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const step = e.key === "ArrowRight" ? 1 : -1;
                  select((current + step + parts.length) % parts.length, true);
                }}
              >
                {parts.map((p, index) => (
                  <button
                    key={p}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${p}`}
                    aria-selected={index === current}
                    aria-controls={`${id}-panel`}
                    tabIndex={index === current ? 0 : -1}
                    onClick={() => select(index)}
                    className={cn("min-h-11 rounded-full px-2 text-muted-foreground transition-colors", TONE[p].tab)}
                  >
                    {t.summary.tab[p]}
                  </button>
                ))}
              </div>

              {/* key: al cambiar de parte se monta de nuevo y vuelve a entrar con su animación. */}
              <div
                key={part}
                role="tabpanel"
                id={`${id}-panel`}
                aria-labelledby={`${id}-tab-${part}`}
                tabIndex={0}
                className="summary-panel flex min-h-44 flex-col gap-3 outline-none"
              >
                <h3 className={cn("text-2xl font-bold tracking-tight", TONE[part].heading)}>{t.summary.heading[part]}</h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  <SegmentsText segments={summary[part] ?? []} t={t} />
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  className="min-h-11 rounded-full"
                  disabled={current === 0}
                  onClick={() => select(current - 1)}
                >
                  <span aria-hidden="true">←</span> {t.summary.previous}
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {current + 1} / {parts.length}
                </span>
                {current === parts.length - 1 ? (
                  <Button variant="accent" className="min-h-11" onClick={close}>
                    {t.summary.toReport} <span aria-hidden="true">→</span>
                  </Button>
                ) : (
                  <Button variant="secondary" className="min-h-11 rounded-full" onClick={() => select(current + 1)}>
                    {t.summary.next} <span aria-hidden="true">→</span>
                  </Button>
                )}
              </div>
            </>
          ) : retrying ? (
            <p role="status" className="flex items-center gap-3 font-medium">
              <span aria-hidden="true" className="analysis-spinner size-5 shrink-0 rounded-full border-2 border-muted border-t-accent" />
              {t.summary.writing}
            </p>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p>{t.summary.unavailable}</p>
              <form action={retryAction}>
                <Button type="submit" variant="secondary" className="min-h-11">
                  {t.summary.retry}
                </Button>
              </form>
              <p aria-live="polite" className="text-sm text-danger">
                {state.error ? t.summary.error[state.error] : null}
              </p>
            </div>
          )}
        </div>

        <p className="border-t px-8 py-5 text-xs text-muted-foreground">{t.summary.footnote}</p>
      </div>

      {/* Al final: al abrir, el foco no cae en "Cerrar". */}
      <button
        type="button"
        onClick={close}
        aria-label={t.summary.close}
        className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </dialog>
  );
}

/** Texto de la IA con cada cifra seguida de su marca (la pone el código, no la IA). */
function SegmentsText({ segments, t }: { segments: Segment[]; t: ReportTexts }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.certainty ? (
          <span key={index} className="whitespace-nowrap text-foreground">
            {segment.text}{" "}
            <span
              className={cn(
                "rounded-full px-1.5 align-middle text-[11px]",
                segment.certainty === "estimated"
                  ? "border border-dashed border-muted-foreground text-muted-foreground"
                  : "bg-muted",
              )}
            >
              {segment.certainty === "estimated" ? t.estimated : t.fromYou}
            </span>
          </span>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}