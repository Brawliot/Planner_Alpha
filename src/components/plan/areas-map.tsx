"use client";

import { useState } from "react";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { AreasLayout } from "@/lib/plan/areas";
import type { Department } from "@/lib/plan/line";
import type { TaskStatus } from "@/lib/plan/task";
import { ActivePanel, type MetroTask } from "./metro-map";

const deptColor = (department: Department | undefined) => (department ? `var(--dept-${department})` : "var(--muted-foreground)");
const VISIBLE_LABEL: readonly TaskStatus[] = ["doing", "waiting"];

export function AreasMap({
  layout,
  lines,
  tasks,
  t,
  reportId,
  initialTaskId,
}: {
  layout: AreasLayout;
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
  // Solo se atenúa el resto al pasar el ratón; la tarea fijada en el panel no apaga el mapa.
  const hoveredTask = hovered ? byId.get(hovered) : undefined;
  const related = hoveredTask ? new Set([hoveredTask.id, ...hoveredTask.dependsOn, ...unlocksOf(hoveredTask.id).map((x) => x.id)]) : null;
  const { center } = layout;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width="100%"
          style={{ minWidth: layout.width * 0.75 }}
          className="block"
          aria-hidden="true"
        >
          {[110, 210, 290].map((r) => (
            <circle key={r} cx={center.x} cy={center.y} r={r} fill="none" stroke="var(--border)" strokeDasharray="2 6" />
          ))}

          {layout.departments.map((d) => (
            <line key={`c-${d.department}`} x1={center.x} y1={center.y} x2={d.x} y2={d.y} stroke={deptColor(d.department)} strokeWidth={2} opacity={0.6} />
          ))}
          {layout.lines.map((l) => (
            <line key={`l-${l.line}`} x1={l.fromX} y1={l.fromY} x2={l.x} y2={l.y} stroke={deptColor(l.department)} strokeWidth={1.5} opacity={0.5} />
          ))}
          {layout.tasks.map((task) => (
            <line
              key={`t-${task.id}`}
              x1={task.fromX}
              y1={task.fromY}
              x2={task.x}
              y2={task.y}
              stroke={deptColor(lines[task.line]?.department)}
              opacity={related && !related.has(task.id) ? 0.08 : 0.3}
            />
          ))}

          {layout.edges.map((edge) => {
            const lit = !!related && related.has(edge.from) && related.has(edge.to);
            return (
              <path
                key={`${edge.from}>${edge.to}`}
                d={`M${edge.x1} ${edge.y1} Q ${center.x} ${center.y} ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={lit ? 1.6 : 1}
                opacity={related && !lit ? 0.08 : lit ? 0.9 : 0.35}
                className="map-flow"
              />
            );
          })}

          <circle cx={center.x} cy={center.y} r={46} fill="var(--background)" stroke="var(--accent)" strokeWidth={1.5} className="map-glow" style={{ color: "var(--accent)" }} />
          <text x={center.x} y={center.y - 4} textAnchor="middle" fill="var(--foreground)" fontSize={12} fontWeight={700}>
            {t.title}
          </text>
          <text x={center.x} y={center.y + 12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
            {center.done}/{center.total}
          </text>

          {layout.departments.map((d) => {
            const R = 26;
            const frac = d.total === 0 ? 0 : d.done / d.total;
            const end = -Math.PI / 2 + frac * 2 * Math.PI;
            const color = deptColor(d.department);
            return (
              <g key={d.department}>
                <circle cx={d.x} cy={d.y} r={R} fill="var(--background)" stroke="var(--border)" strokeWidth={4} />
                {frac >= 1 ? (
                  <circle cx={d.x} cy={d.y} r={R} fill="none" stroke={color} strokeWidth={4} className="map-glow" style={{ color }} />
                ) : frac > 0 ? (
                  <path
                    d={`M${d.x} ${d.y - R} A ${R} ${R} 0 ${frac > 0.5 ? 1 : 0} 1 ${d.x + Math.cos(end) * R} ${d.y + Math.sin(end) * R}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    className="map-glow"
                    style={{ color }}
                  />
                ) : null}
                <text x={d.x} y={d.y + 4} textAnchor="middle" fill="var(--foreground)" fontSize={11} fontWeight={700}>
                  {d.done}/{d.total}
                </text>
                <text x={d.x} y={d.y - R - 8} textAnchor="middle" fill={color} fontSize={10} fontFamily="var(--font-mono)">
                  {t.department[d.department].toUpperCase()}
                </text>
              </g>
            );
          })}

          {layout.lines.map((l) => {
            const right = Math.cos(l.angle) > 0;
            return (
              <g key={`n-${l.line}`}>
                <rect
                  x={l.x - 5}
                  y={l.y - 5}
                  width={10}
                  height={10}
                  rx={2}
                  fill="var(--background)"
                  stroke={deptColor(l.department)}
                  strokeWidth={2}
                  transform={`rotate(45 ${l.x} ${l.y})`}
                />
                <text x={l.x + (right ? 10 : -10)} y={l.y - 8} textAnchor={right ? "start" : "end"} fill="var(--foreground)" fontSize={11}>
                  {l.goal.length > 28 ? `${l.goal.slice(0, 27)}…` : l.goal}
                </text>
              </g>
            );
          })}

          {layout.tasks.map((task) => {
            const color = deptColor(lines[task.line]?.department);
            const done = task.status === "done";
            const showLabel = VISIBLE_LABEL.includes(task.status) || activeId === task.id;
            return (
              <g
                key={task.id}
                onMouseEnter={() => setHovered(task.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(task.id)}
                className="cursor-pointer transition-opacity"
                opacity={related && !related.has(task.id) ? 0.18 : 1}
              >
                <circle cx={task.x} cy={task.y} r={16} fill="transparent" />
                {task.status === "doing" && <circle cx={task.x} cy={task.y} r={7} fill="none" stroke={color} strokeWidth={2} className="map-pulse" />}
                <circle
                  cx={task.x}
                  cy={task.y}
                  r={7}
                  fill={done ? color : "var(--background)"}
                  stroke={color}
                  strokeWidth={2.5}
                  strokeDasharray={task.status === "waiting" ? "3 3" : undefined}
                  opacity={task.status === "blocked" ? 0.55 : 1}
                  className={task.status === "doing" ? "map-glow" : undefined}
                  style={{ color }}
                />
                {done && <path d={`M${task.x - 3} ${task.y}l2.5 2.5 4-5`} stroke="var(--background)" strokeWidth={2} fill="none" strokeLinecap="round" />}
                {showLabel && (
                  <text
                    x={task.x + (task.right ? 14 : -14)}
                    y={task.y + 4}
                    textAnchor={task.right ? "start" : "end"}
                    fill="var(--foreground)"
                    fontSize={10}
                  >
                    {task.title}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
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
          <p className="text-sm text-muted-foreground">{t.overview.hint}</p>
        )}
      </aside>
    </div>
  );
}