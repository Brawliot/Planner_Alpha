"use client";

import { useEffect, useRef, useState } from "react";
import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import { DEPARTMENTS, type Department } from "@/lib/plan/line";
import { timelineTrack, type TrackBar, type TrackRange, type TrackRow } from "@/lib/plan/timeline-track";
import type { PlanView } from "@/lib/plan/view";
import { cn } from "@/lib/cn";
import type { MetroTask } from "./metro-map";
import { useOpenDepartments } from "./use-open-departments";

const deptColor = (department: Department) => `var(--dept-${department})`;

/** Altos de fila compartidos por la columna de nombres (HTML) y las barras (SVG): así no se descuadran. */
const ROW: Record<TrackRow["kind"], number> = { department: 52, objective: 30, task: 40 };
const HEAD = 48;
const FOOT = 40;
const LABELS = 260;
/** Hueco a la derecha de la ventana para "→ S30". */
const TAIL = 56;
const MIN_WEEK = 28;
/** Ancho de semana antes de medir (en el servidor). */
const DEFAULT_WEEK = 44;

export function TimelineChart({
  view,
  today,
  t,
  reportId,
  hovered,
  onHover,
  onSelect,
}: {
  view: PlanView;
  today: string;
  tasks: MetroTask[];
  t: PlanTexts;
  reportId: string;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const [expanded, toggle] = useOpenDepartments(reportId);
  // Siempre se abre en las próximas 12 semanas; la elección no se recuerda.
  const [range, setRange] = useState<TrackRange>("next");
  const track = timelineTrack(view, today, expanded, range);

  const box = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const weeks = track.to - track.from;
  const week = available === null ? DEFAULT_WEEK : Math.max(MIN_WEEK, (available - LABELS - TAIL) / weeks);
  const width = weeks * week;
  const x = (w: number) => (w - track.from) * week;

  const tops: number[] = [];
  let bottom = HEAD;
  for (const row of track.rows) {
    tops.push(bottom);
    bottom += ROW[row.kind];
  }
  const height = bottom + FOOT;
  const every = week < 34 ? 2 : 1;
  const weekLabel = (n: number) => `${t.overview.weekShort}${n}`;

  const rangeButton = (id: TrackRange, label: string) => (
    <button
      type="button"
      aria-pressed={range === id}
      onClick={() => setRange(id)}
      className={cn("min-h-9 rounded-full px-3", range === id ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </button>
  );

  const bar = (b: TrackBar, y: number, h: number, department: Department, waiting: boolean) => {
    const solid = Math.max(x(b.endMin) - x(b.start) - 2, 6);
    return (
      <>
        {b.endMax > b.endMin && (
          <rect x={x(b.endMin)} y={y - h / 2} width={x(b.endMax) - x(b.endMin)} height={h} rx={h / 2} fill={`url(#tl-${department})`} />
        )}
        <rect x={x(b.start) + 1} y={y - h / 2} width={solid} height={h} rx={h / 2} fill={deptColor(department)} />
        {waiting && (
          <rect x={x(b.start) + 1} y={y - h / 2} width={solid} height={h} rx={h / 2} fill="none" stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="3 3" />
        )}
        {b.beyond !== null && (
          <text x={width + 8} y={y + 4} fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
            → {weekLabel(b.beyond)}
          </text>
        )}
      </>
    );
  };
  const startsLater = (n: number | null, y: number) =>
    n !== null && (
      <text x={width - 6} y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
        {fillText(t.overview.startsAt, { week: weekLabel(n) })} →
      </text>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2 text-xs">
        <span className="text-muted-foreground">{t.overview.rangeLabel}</span>
        <div className="flex rounded-full border border-border bg-surface p-0.5">
          {rangeButton("next", t.overview.rangeNext)}
          {rangeButton("all", t.overview.rangeAll)}
        </div>
      </div>

      <div ref={box} className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `${LABELS}px ${width + TAIL}px` }}>
          {/* Columna de nombres: fija al desplazar en horizontal. */}
          <div className="sticky left-0 z-10 bg-background/90 backdrop-blur-sm">
            <div style={{ height: HEAD }} />
            {track.rows.map((row) => {
              const color = deptColor(row.department);
              if (row.kind === "department") {
                const count = row.objectives === 1 ? t.overview.objectiveOne : fillText(t.overview.objectiveMany, { n: row.objectives });
                return (
                  <button
                    key={row.key}
                    type="button"
                    data-dept={row.department}
                    aria-expanded={row.open}
                    onClick={() => toggle(row.department)}
                    style={{ height: ROW.department }}
                    className="flex w-full flex-col justify-center border-b border-border/50 pr-3 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold" style={{ color }}>
                      <span aria-hidden="true" className="w-3 text-xs text-muted-foreground">
                        {row.open ? "▾" : "▸"}
                      </span>
                      <span className="truncate">{t.department[row.department]}</span>
                    </span>
                    <span className="ml-5 truncate font-mono text-[11px] text-muted-foreground">
                      {count} · {row.done}/{row.total}
                      {row.signal.now > 0 && <span className="text-accent"> · {fillText(t.overview.areaNow, { n: row.signal.now })}</span>}
                      {row.signal.waiting > 0 && <span className="text-warning"> · {fillText(t.overview.areaWaiting, { n: row.signal.waiting })}</span>}
                    </span>
                  </button>
                );
              }
              if (row.kind === "objective") {
                return (
                  <div key={row.key} style={{ height: ROW.objective }} className="flex items-center pr-3 pl-5 text-xs font-semibold text-muted-foreground">
                    <span className="truncate">{row.goal}</span>
                  </div>
                );
              }
              return (
                <div
                  key={row.key}
                  onMouseEnter={() => onHover(row.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(row.id)}
                  style={{ height: ROW.task }}
                  className={cn("flex cursor-pointer items-center gap-2 pr-3 pl-8 text-sm", hovered === row.id && "bg-muted/50")}
                >
                  {row.now && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />}
                  <span className="truncate">{row.title}</span>
                </div>
              );
            })}
          </div>

          <svg width={width + TAIL} height={height} className="block" aria-hidden="true">
            <defs>
              {DEPARTMENTS.map((department) => (
                <linearGradient key={department} id={`tl-${department}`}>
                  <stop offset="0" stopColor={deptColor(department)} stopOpacity={0.45} />
                  <stop offset="1" stopColor={deptColor(department)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            {/* Cabecera: meses arriba (con su línea) y semanas debajo. */}
            {track.months.map((month) => (
              <g key={month.week}>
                <line x1={x(month.week)} y1={0} x2={x(month.week)} y2={bottom} stroke="var(--border)" />
                <text x={x(month.week) + 4} y={16} fill="var(--foreground)" fontSize={12} fontWeight={600}>
                  {month.label}
                </text>
              </g>
            ))}
            {Array.from({ length: weeks }, (_, i) => track.from + i)
              .filter((w) => (w - track.from) % every === 0)
              .map((w) => (
                <text key={w} x={x(w) + week / 2} y={36} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
                  {weekLabel(w + 1)}
                </text>
              ))}

            {track.rows.map((row, i) => {
              const top = tops[i];
              const mid = top + ROW[row.kind] / 2;
              if (row.kind === "department") {
                return (
                  <g key={row.key}>
                    <line x1={0} y1={top + ROW.department} x2={width} y2={top + ROW.department} stroke="var(--border)" strokeOpacity={0.5} />
                    {row.segments.map((segment) => (
                      <g key={segment.start}>{bar(segment, mid, row.open ? 6 : 14, row.department, false)}</g>
                    ))}
                    {startsLater(row.startsAt, mid)}
                  </g>
                );
              }
              if (row.kind === "objective") return null;
              return (
                <g
                  key={row.key}
                  onMouseEnter={() => onHover(row.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(row.id)}
                  className="cursor-pointer"
                >
                  <rect x={0} y={top} width={width} height={ROW.task} fill={hovered === row.id ? "color-mix(in oklab, var(--foreground) 6%, transparent)" : "transparent"} />
                  {row.bar && row.now && <circle cx={x(row.bar.start) - 8} cy={mid} r={4} fill="var(--accent)" />}
                  {row.bar && bar(row.bar, mid, 10, row.department, row.status === "waiting" || row.status === "blocked")}
                  {startsLater(row.startsAt, mid)}
                </g>
              );
            })}

            {/* Apertura: franja fina en la cabecera y línea en su primera semana, sin velo sobre las filas. */}
            {track.opening && view.opening && (
              <g>
                <rect x={x(track.opening.start)} y={HEAD - 6} width={x(track.opening.end) - x(track.opening.start)} height={4} rx={2} fill="var(--accent)" opacity={0.5} />
                <line x1={x(track.opening.start)} y1={HEAD - 6} x2={x(track.opening.start)} y2={bottom + 8} stroke="var(--accent)" strokeDasharray="3 5" opacity={0.55} />
                <text x={x(track.opening.start) + 4} y={bottom + 26} fill="var(--accent)" fontSize={12} fontWeight={600}>
                  ◆ {t.overview.openingBand} · {t.weeks} {view.opening.weeks.from}–{view.opening.weeks.to} · {t.estimated}
                  {track.opening.cut ? " →" : ""}
                </text>
              </g>
            )}

            {track.today !== null && (
              <g>
                <line x1={x(track.today)} y1={HEAD - 8} x2={x(track.today)} y2={bottom} stroke="var(--accent)" strokeWidth={2} />
                <text x={x(track.today) + 4} y={HEAD + 10} fill="var(--accent)" fontSize={9} fontFamily="var(--font-mono)">
                  {t.overview.today}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full bg-dept-sales" />
          {t.overview.sure}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--dept-sales) 45%, transparent), transparent)" }} />
          {t.overview.estimatedRange}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-0.5 bg-accent" />
          {t.overview.today.toLowerCase()}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" />
          {t.overview.nowTag.toLowerCase()}
        </span>
      </div>
    </div>
  );
}