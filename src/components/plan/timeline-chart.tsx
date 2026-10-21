"use client";

import { useState } from "react";
import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import { DEPARTMENTS, type Department } from "@/lib/plan/line";
import type { TimelineLayout } from "@/lib/plan/timeline-chart";
import { ActivePanel, type MetroTask } from "./metro-map";

const deptColor = (department: Department | null) => (department ? `var(--dept-${department})` : "var(--muted-foreground)");
const short = (text: string, max = 30) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function TimelineChart({
  layout,
  lines,
  tasks,
  t,
  reportId,
  initialTaskId,
}: {
  layout: TimelineLayout;
  lines: { department: Department; goal: string }[];
  tasks: MetroTask[];
  t: PlanTexts;
  reportId: string;
  initialTaskId: string | null;
}) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const [selected, setSelected] = useState<string | null>(initialTaskId);
  const [hovered, setHovered] = useState<string | null>(null);
  const activeId = hovered ?? selected;
  const active = activeId ? byId.get(activeId) : undefined;
  const unlocksOf = (id: string) => tasks.filter((task) => task.dependsOn.includes(id));
  const related = active ? new Set([active.id, ...active.dependsOn, ...unlocksOf(active.id).map((x) => x.id)]) : null;
  const bottom = layout.height - 34;

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
              <line
                x1={week.x}
                y1={layout.rows[0] ? layout.rows[0].y - 8 : 48}
                x2={week.x}
                y2={bottom}
                stroke="var(--border)"
                strokeDasharray={(week.index - 1) % 4 === 0 ? undefined : "1 5"}
              />
              <text x={week.x + 22} y={40} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
                {t.overview.weekShort}
                {week.index}
              </text>
            </g>
          ))}

          {layout.opening && (
            <g>
              <rect
                x={layout.opening.x1}
                y={48}
                width={layout.opening.x2 - layout.opening.x1}
                height={bottom - 48}
                fill="color-mix(in oklab, var(--accent) 8%, transparent)"
              />
              <text
                x={(layout.opening.x1 + layout.opening.x2) / 2}
                y={layout.height - 14}
                textAnchor="middle"
                fill="var(--accent)"
                fontSize={11}
                fontWeight={700}
              >
                ◆ {t.overview.openingBand} · {t.estimated}
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
            const lit = !!related && related.has(edge.from) && related.has(edge.to);
            return (
              <path
                key={`${edge.from}>${edge.to}`}
                d={`M${edge.x1} ${edge.y1} C ${edge.x1 + 22} ${edge.y1}, ${edge.x2 - 22} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke={lit ? "var(--accent)" : "var(--muted-foreground)"}
                strokeWidth={lit ? 1.5 : 1}
                opacity={related && !lit ? 0.1 : 0.45}
              />
            );
          })}

          {layout.rows.map((row) => {
            if (row.kind === "department") {
              return (
                <text key={`d-${row.department}`} x={12} y={row.y + 4} fill={deptColor(row.department)} fontSize={10} fontFamily="var(--font-mono)">
                  {t.department[row.department].toUpperCase()}
                </text>
              );
            }
            const { task } = row;
            const color = deptColor(task.department);
            const dimmed = !!related && !related.has(task.id);
            const solid = Math.max(row.xMin - row.x1, 6);
            const pct = task.progress.total === 0 ? 0 : task.progress.done / task.progress.total;
            return (
              <g
                key={row.id}
                onMouseEnter={() => setHovered(task.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(task.id)}
                className="cursor-pointer transition-opacity"
                opacity={dimmed ? 0.18 : 1}
              >
                <rect x={0} y={row.y - 14} width={layout.width} height={28} fill="transparent" />
                <text x={24} y={row.y + 4} fill="var(--foreground)" fontSize={12}>
                  {short(task.title)}
                </text>
                {row.xMax > row.xMin && (
                  <rect
                    x={row.xMin}
                    y={row.y - 8}
                    width={row.xMax - row.xMin}
                    height={16}
                    rx={4}
                    fill={task.department ? `url(#tl-${task.department})` : "transparent"}
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
            line={lines[active.line]}
            before={active.dependsOn.flatMap((id) => byId.get(id) ?? [])}
            unlocks={unlocksOf(active.id)}
            t={t}
            reportId={reportId}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{fillText(t.overview.hint, {})}</p>
        )}
      </aside>
    </div>
  );
}