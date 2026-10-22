"use client";

import { useState } from "react";
import type { PlanTexts } from "@/lib/plan/i18n";
import { DEPARTMENTS, type Department } from "@/lib/plan/line";
import { timelineGroups } from "@/lib/plan/timeline-chart";
import type { PlanView } from "@/lib/plan/view";
import { ActivePanel, type MetroTask } from "./metro-map";
import { useOpenDepartments } from "./use-open-departments";

const deptColor = (department: Department) => `var(--dept-${department})`;
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function TimelineChart({
  view,
  today,
  tasks,
  t,
  reportId,
  initialTaskId,
}: {
  view: PlanView;
  today: string;
  tasks: MetroTask[];
  t: PlanTexts;
  reportId: string;
  initialTaskId: string | null;
}) {
  const [expanded, toggle] = useOpenDepartments(reportId);
  const layout = timelineGroups(view, today, expanded);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const [selected, setSelected] = useState<string | null>(initialTaskId);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = byId.get(hovered ?? selected ?? "");
  const unlocksOf = (id: string) => tasks.filter((task) => task.dependsOn.includes(id));
  // Solo se atenúa el resto al pasar el ratón; la tarea fijada en el panel no apaga el mapa.
  const hoveredTask = hovered ? byId.get(hovered) : undefined;
  const related = hoveredTask ? new Set([hoveredTask.id, ...hoveredTask.dependsOn, ...unlocksOf(hoveredTask.id).map((x) => x.id)]) : null;
  const rowOfTask = (row: string) => (row.startsWith("t:") ? row.slice(2) : null);
  const bottom = layout.height - 34;
  const firstRowY = layout.rows[0]?.y ?? 64;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-3 overflow-x-auto">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} className="block" aria-hidden="true">
          <defs>
            {DEPARTMENTS.map((department) => (
              <linearGradient key={department} id={`tl-${department}`}>
                <stop offset="0" stopColor={deptColor(department)} stopOpacity={0.55} />
                <stop offset="1" stopColor={deptColor(department)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {layout.weeks.map((week) => (
            <g key={week.index}>
              <line x1={week.x} y1={firstRowY - 20} x2={week.x} y2={bottom} stroke="var(--border)" strokeDasharray={(week.index - 1) % 4 === 0 ? undefined : "1 5"} />
              <text x={week.x + 22} y={40} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
                {t.overview.weekShort}
                {week.index}
              </text>
            </g>
          ))}

          {layout.opening && view.opening && (
            <g>
              <rect x={layout.opening.x1} y={48} width={layout.opening.x2 - layout.opening.x1} height={bottom - 48} fill="color-mix(in oklab, var(--accent) 8%, transparent)" />
              <text x={(layout.opening.x1 + layout.opening.x2) / 2} y={layout.height - 14} textAnchor="middle" fill="var(--accent)" fontSize={11} fontWeight={700}>
                ◆ {t.overview.openingBand} · {t.weeks} {view.opening.weeks.from}–{view.opening.weeks.to} · {t.estimated}
              </text>
            </g>
          )}

          {layout.todayX !== null && (
            <g>
              <line x1={layout.todayX} y1={44} x2={layout.todayX} y2={bottom} stroke="var(--accent)" strokeWidth={1.5} className="map-glow" style={{ color: "var(--accent)" }} />
              <text x={layout.todayX} y={24} textAnchor="middle" fill="var(--accent)" fontSize={10} fontFamily="var(--font-mono)">
                {t.overview.today}
              </text>
            </g>
          )}

          {layout.edges.map((edge) => {
            const a = rowOfTask(edge.from);
            const b = rowOfTask(edge.to);
            const lit = !!related && !!a && !!b && related.has(a) && related.has(b);
            return (
              <path
                key={`${edge.from}@${edge.x1}>${edge.to}@${edge.x2}`}
                d={`M${edge.x1} ${edge.y1} C ${edge.x1 + 22} ${edge.y1}, ${edge.x2 - 22} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke={lit ? "var(--accent)" : "var(--muted-foreground)"}
                strokeWidth={lit ? 1.5 : 1}
                opacity={related && !lit ? 0.1 : 0.45}
              />
            );
          })}

          {layout.rows.map((row) => {
            const color = deptColor(row.department);
            if (row.kind === "department") {
              const count = row.objectives === 1 ? t.overview.objectiveOne : fillText(t.overview.objectiveMany, { n: row.objectives });
              return (
                <g key={row.key} onClick={() => toggle(row.department)} className="cursor-pointer" data-dept={row.department}>
                  <rect x={0} y={row.y - 16} width={layout.width} height={32} fill={row.open ? `color-mix(in oklab, ${color} 7%, transparent)` : "transparent"} />
                  <text x={10} y={row.y + 4} fill="var(--muted-foreground)" fontSize={12}>
                    {row.open ? "▾" : "▸"}
                  </text>
                  <text x={26} y={row.y + 1} fill={color} fontSize={12} fontWeight={700}>
                    {short(t.department[row.department], 22)}
                  </text>
                  <text x={26} y={row.y + 13} fill="var(--muted-foreground)" fontSize={9} fontFamily="var(--font-mono)">
                    {`${count} · ${row.done}/${row.total}`.toUpperCase()}
                  </text>
                  {row.segments.map((segment) => {
                    const solid = Math.max(segment.xMin - segment.x1, 6);
                    const height = row.open ? 4 : 16;
                    return (
                      <g key={segment.x1}>
                        {!row.open && segment.xMax > segment.xMin && (
                          <rect
                            x={segment.xMin}
                            y={row.y - height / 2}
                            width={segment.xMax - segment.xMin}
                            height={height}
                            rx={4}
                            fill={`url(#tl-${row.department})`}
                            stroke={color}
                            strokeDasharray="2 3"
                            strokeOpacity={0.6}
                          />
                        )}
                        <rect
                          x={segment.x1}
                          y={row.y - height / 2}
                          width={row.open ? segment.xMax - segment.x1 : solid}
                          height={height}
                          rx={row.open ? 2 : 4}
                          fill={`color-mix(in oklab, ${color} 30%, var(--background))`}
                          stroke={row.open ? "none" : color}
                          strokeWidth={1.5}
                        />
                        {!row.open && row.progress > 0 && (
                          <rect x={segment.x1} y={row.y - 8} width={solid * row.progress} height={16} rx={4} fill={color} opacity={0.9} />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            }
            if (row.kind === "objective") {
              return (
                <g key={row.key}>
                  <path d={`M16 ${row.y - 14} V ${row.y} H 24`} fill="none" stroke={color} opacity={0.4} />
                  <text x={30} y={row.y + 4} fill="var(--foreground)" fontSize={12} fontWeight={600}>
                    {short(row.goal, 28)}
                  </text>
                </g>
              );
            }
            const { task } = row;
            const dimmed = !!related && !related.has(task.id);
            const solid = Math.max(row.xMin - row.x1, 6);
            const pct = task.progress.total === 0 ? 0 : task.progress.done / task.progress.total;
            return (
              <g
                key={row.key}
                onMouseEnter={() => setHovered(task.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(task.id)}
                className="cursor-pointer transition-opacity"
                opacity={dimmed ? 0.18 : 1}
              >
                <rect x={0} y={row.y - 14} width={layout.width} height={28} fill="transparent" />
                <text x={40} y={row.y + 4} fill="var(--foreground)" fontSize={12}>
                  {short(task.title, 26)}
                </text>
                {row.xMax > row.xMin && (
                  <rect
                    x={row.xMin}
                    y={row.y - 8}
                    width={row.xMax - row.xMin}
                    height={16}
                    rx={4}
                    fill={`url(#tl-${row.department})`}
                    stroke={color}
                    strokeDasharray="2 3"
                    strokeOpacity={0.6}
                  />
                )}
                <rect
                  x={row.x1}
                  y={row.y - 8}
                  width={solid}
                  height={16}
                  rx={4}
                  fill={`color-mix(in oklab, ${color} 30%, var(--background))`}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray={task.status === "waiting" ? "3 3" : undefined}
                />
                {pct > 0 && <rect x={row.x1} y={row.y - 8} width={solid * pct} height={16} rx={4} fill={color} opacity={0.9} />}
              </g>
            );
          })}
        </svg>

        <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-6 rounded-sm bg-dept-sales" />
            {t.overview.sure}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-6 rounded-sm"
              style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--dept-sales) 55%, transparent), transparent)" }}
            />
            {t.overview.estimatedRange}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-0.5 bg-accent" />
            {t.overview.today.toLowerCase()}
          </span>
        </div>
      </div>

      <aside className="flex flex-col gap-3 self-start rounded-[1rem] border bg-background/80 p-5 backdrop-blur">
        {active ? (
          <ActivePanel
            task={active}
            line={view.lines[active.line]}
            before={active.dependsOn.flatMap((id) => byId.get(id) ?? [])}
            unlocks={unlocksOf(active.id)}
            t={t}
            reportId={reportId}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t.overview.hint}</p>
        )}
      </aside>
    </div>
  );
}