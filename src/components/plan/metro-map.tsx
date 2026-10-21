"use client";

import Link from "next/link";
import { useState } from "react";
import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import type { Department } from "@/lib/plan/line";
import type { MetroLayout, MetroStation } from "@/lib/plan/metro";
import type { TaskStatus } from "@/lib/plan/task";
import { cn } from "@/lib/cn";

/** Lo que el panel necesita de cada tarea (serializable: viene del servidor). */
export interface MetroTask {
  id: string;
  title: string;
  status: TaskStatus;
  progress: { done: number; total: number };
  line: number;
  dependsOn: string[];
  weeks: { from: number; to: number } | null;
  estimated: boolean;
}

const deptColor = (department: Department) => `var(--dept-${department})`;
const short = (text: string, max = 24) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const LABEL = "font-mono text-[10px] uppercase tracking-[0.14em]";

export function MetroMap({
  layout,
  lines,
  tasks,
  t,
  reportId,
  initialTaskId,
}: {
  layout: MetroLayout;
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
  const stationByKey = new Map(layout.stations.map((s) => [s.key, s]));
  const isRelated = (station: MetroStation | undefined) => !related || !station || station.tasks.some((x) => related.has(x.id));
  const colorOfLine = (line: number) => deptColor(lines[line]?.department ?? "founder");

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
          {layout.columns.map((column) => (
            <g key={column.phase}>
              <rect
                x={column.x - 97}
                y={16}
                width={194}
                height={layout.height - 24}
                rx={14}
                fill={column.started ? "color-mix(in oklab, var(--accent) 4%, transparent)" : "transparent"}
                stroke="var(--border)"
                strokeDasharray="2 4"
              />
              <text x={column.x} y={42} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontWeight={700}>
                {t.phase[column.phase]}
              </text>
              <text x={column.x} y={58} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
                {fillText(t.overview.phaseDone, { done: column.done, total: column.total }).toUpperCase()}
              </text>
            </g>
          ))}

          {layout.rows.map((row) => {
            const line = lines[row.line];
            if (!line) return null;
            return (
              <g key={row.line}>
                <text x={12} y={row.y - 4} fill={deptColor(line.department)} fontSize={10} fontFamily="var(--font-mono)">
                  {t.department[line.department].toUpperCase()}
                </text>
                <text x={12} y={row.y + 11} fill="var(--foreground)" fontSize={12}>
                  {short(line.goal, 26)}
                </text>
              </g>
            );
          })}

          {layout.tracks.map((track) => {
            const color = colorOfLine(track.line);
            return (
              <g key={track.line}>
                <line x1={track.x1 - 30} y1={track.y} x2={track.x2 + 30} y2={track.y} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.3} />
                {track.reachedX !== null && (
                  <line
                    x1={track.x1 - 30}
                    y1={track.y}
                    x2={track.reachedX}
                    y2={track.y}
                    stroke={color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    className="map-glow"
                    style={{ color }}
                  />
                )}
              </g>
            );
          })}

          {layout.edges.map((edge) => {
            const from = stationByKey.get(edge.from);
            const to = stationByKey.get(edge.to);
            const lit = !!related && !!from && !!to && isRelated(from) && isRelated(to);
            const ready = from?.tasks.every((x) => x.status === "done") ?? false;
            return (
              <path
                key={`${edge.from}>${edge.to}`}
                d={`M${edge.x1} ${edge.y1} C ${edge.x1 + 60} ${edge.y1}, ${edge.x2 - 60} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke={lit ? "var(--accent)" : "var(--muted-foreground)"}
                strokeWidth={lit ? 1.6 : 1.2}
                opacity={related && !lit ? 0.12 : 0.5}
                className={ready ? "map-flow" : undefined}
              />
            );
          })}

          {layout.stations.map((station) => (
            <Station
              key={station.key}
              station={station}
              color={colorOfLine(station.line)}
              dimmed={!isRelated(station)}
              onEnter={() => setHovered(station.lead.id)}
              onLeave={() => setHovered(null)}
              onSelect={() => setSelected(station.lead.id)}
            />
          ))}
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

function Station({
  station,
  color,
  dimmed,
  onEnter,
  onLeave,
  onSelect,
}: {
  station: MetroStation;
  color: string;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const { x, y, tasks } = station;
  const doing = tasks.some((task) => task.status === "doing");
  const label = station.extra > 0 ? `${short(station.lead.title)} +${station.extra}` : short(station.lead.title);

  return (
    <g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onSelect}
      className="cursor-pointer transition-opacity"
      opacity={dimmed ? 0.18 : 1}
    >
      {/* Zona de clic generosa alrededor de la estación. */}
      <circle cx={x} cy={y} r={20} fill="transparent" />
      {doing && <circle cx={x} cy={y} r={9} fill="none" stroke={color} strokeWidth={2} className="map-pulse" />}
      {tasks.length === 1 ? <SingleStation x={x} y={y} status={tasks[0].status} color={color} /> : <GroupStation x={x} y={y} tasks={tasks} color={color} />}
      <text x={x} y={y + (tasks.length === 1 ? 24 : 27)} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10}>
        {label}
      </text>
    </g>
  );
}

/** Hecha (rellena con ✓), en curso (brilla), esperando (discontinua), por hacer (hueca), bloqueada (hueca tenue). */
function SingleStation({ x, y, status, color }: { x: number; y: number; status: TaskStatus; color: string }) {
  const done = status === "done";
  return (
    <>
      <circle
        cx={x}
        cy={y}
        r={9}
        fill={done ? color : "var(--background)"}
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={status === "waiting" ? "3 3" : undefined}
        opacity={status === "blocked" ? 0.55 : 1}
        className={status === "doing" ? "map-glow" : undefined}
        style={{ color }}
      />
      {done && <path d={`M${x - 4} ${y}l3 3 5-6`} stroke="var(--background)" strokeWidth={2} fill="none" strokeLinecap="round" />}
    </>
  );
}

/** Varias tareas: un segmento de anillo por tarea y el número en el centro. */
function GroupStation({ x, y, tasks, color }: { x: number; y: number; tasks: MetroStation["tasks"]; color: string }) {
  const R = 12;
  const gap = 0.35;
  const n = tasks.length;
  return (
    <>
      <circle cx={x} cy={y} r={R - 4} fill="var(--background)" />
      {tasks.map((task, i) => {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n + gap / 2;
        const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / n - gap / 2;
        return (
          <path
            key={task.id}
            d={`M${x + Math.cos(a0) * R} ${y + Math.sin(a0) * R} A ${R} ${R} 0 0 1 ${x + Math.cos(a1) * R} ${y + Math.sin(a1) * R}`}
            fill="none"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={task.status === "waiting" ? "2 3" : undefined}
            opacity={task.status === "todo" || task.status === "blocked" ? 0.35 : 1}
            className={task.status === "doing" ? "map-glow" : undefined}
            style={{ color }}
          />
        );
      })}
      <text x={x} y={y + 4} textAnchor="middle" fill="var(--foreground)" fontSize={11} fontWeight={700}>
        {n}
      </text>
    </>
  );
}

function ActivePanel({
  task,
  line,
  before,
  unlocks,
  t,
  reportId,
}: {
  task: MetroTask;
  line: { department: Department; goal: string } | undefined;
  before: MetroTask[];
  unlocks: MetroTask[];
  t: PlanTexts;
  reportId: string;
}) {
  const color = line ? deptColor(line.department) : "var(--muted-foreground)";
  const pct = task.progress.total === 0 ? 0 : (task.progress.done / task.progress.total) * 100;
  return (
    <>
      {line && (
        <p className={LABEL} style={{ color }}>
          {t.department[line.department]} · {line.goal}
        </p>
      )}
      <p className="text-lg leading-tight font-semibold">{task.title}</p>
      <p className="text-sm text-muted-foreground">{t.overview.taskStatus[task.status]}</p>
      <div className="flex items-center gap-3 text-xs">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        {fillText(t.task.progress, { done: task.progress.done, total: task.progress.total })}
      </div>
      {task.weeks && (
        <p className="text-xs text-muted-foreground">
          {t.weeks} {task.weeks.from}–{task.weeks.to}{" "}
          {task.estimated && (
            <span className="rounded-full border border-dashed border-muted-foreground px-2 text-[11px]">{t.estimated}</span>
          )}
        </p>
      )}
      {before.length > 0 && <TaskNames title={t.task.before} tasks={before} />}
      {unlocks.length > 0 && <TaskNames title={t.task.unlocks} tasks={unlocks} />}
      <Link
        href={`/informe/${reportId}/plan/tarea/${encodeURIComponent(task.id)}`}
        className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:brightness-95"
      >
        {t.overview.openTask} <span aria-hidden="true">&nbsp;→</span>
      </Link>
    </>
  );
}

function TaskNames({ title, tasks }: { title: string; tasks: MetroTask[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className={cn(LABEL, "text-muted-foreground")}>{title}</p>
      {tasks.map((task) => (
        <p key={task.id} className={cn("text-sm", task.status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </p>
      ))}
    </div>
  );
}