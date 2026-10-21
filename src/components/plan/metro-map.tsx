"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import { DEPARTMENTS, type Department } from "@/lib/plan/line";
import { metroLayout, type MetroStation } from "@/lib/plan/metro";
import type { TaskStatus } from "@/lib/plan/task";
import type { PlanView } from "@/lib/plan/view";
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

// Departamentos abiertos, recordados en este navegador por informe. Sin nada guardado: todos plegados.
const openKey = (reportId: string) => `mando:plan-abiertos:${reportId}`;
function readOpen(reportId: string) {
  try {
    return window.localStorage.getItem(openKey(reportId)) ?? "";
  } catch {
    return "";
  }
}
function writeOpen(reportId: string, value: string) {
  try {
    window.localStorage.setItem(openKey(reportId), value);
  } catch {
    // Almacenamiento bloqueado: se abre y se cierra igual, solo que no se recuerda.
  }
}
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const parseOpen = (value: string) =>
  new Set(value.split(",").filter((d): d is Department => (DEPARTMENTS as readonly string[]).includes(d)));

export function MetroMap({
  view,
  tasks,
  t,
  reportId,
  initialTaskId,
}: {
  view: PlanView;
  tasks: MetroTask[];
  t: PlanTexts;
  reportId: string;
  initialTaskId: string | null;
}) {
  const stored = useSyncExternalStore(subscribe, () => readOpen(reportId), () => "");
  const [override, setOverride] = useState<string | null>(null);
  const expanded = parseOpen(override ?? stored);
  const toggle = (department: Department) => {
    const next = new Set(expanded);
    if (next.has(department)) next.delete(department);
    else next.add(department);
    const value = [...next].join(",");
    setOverride(value);
    writeOpen(reportId, value);
  };

  const layout = metroLayout(view, expanded);
  const lines = view.lines;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const [selected, setSelected] = useState<string | null>(initialTaskId);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = byId.get(hovered ?? selected ?? "");
  const unlocksOf = (id: string) => tasks.filter((task) => task.dependsOn.includes(id));
  // Solo se atenúa el resto al pasar el ratón; la tarea fijada en el panel no apaga el mapa.
  const hoveredTask = hovered ? byId.get(hovered) : undefined;
  const related = hoveredTask ? new Set([hoveredTask.id, ...hoveredTask.dependsOn, ...unlocksOf(hoveredTask.id).map((x) => x.id)]) : null;
  const stationByKey = new Map(layout.stations.map((s) => [s.key, s]));
  const isRelated = (station: MetroStation | undefined) => !related || !station || station.tasks.some((x) => related.has(x.id));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" style={{ minWidth: layout.width * 0.75 }} className="block" aria-hidden="true">
          {layout.columns.map((column) => (
            <g key={column.phase}>
              <rect
                x={column.x - 97}
                y={14}
                width={194}
                height={layout.height - 18}
                rx={14}
                fill={column.started ? "color-mix(in oklab, var(--accent) 4%, transparent)" : "transparent"}
                stroke="var(--border)"
                strokeDasharray="2 4"
              />
              <text x={column.x} y={40} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontWeight={700}>
                {t.phase[column.phase]}
              </text>
              <text x={column.x} y={56} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
                {fillText(t.overview.phaseDone, { done: column.done, total: column.total }).toUpperCase()}
              </text>
            </g>
          ))}

          {layout.rows.map((row) => {
            const color = deptColor(row.department);
            if (row.kind === "department") {
              const count = row.lines.length === 1 ? t.overview.objectiveOne : fillText(t.overview.objectiveMany, { n: row.lines.length });
              return (
                <g key={row.key} onClick={() => toggle(row.department)} className="cursor-pointer">
                  <rect x={6} y={row.y - 22} width={190} height={44} rx={10} fill={row.open ? `color-mix(in oklab, ${color} 10%, transparent)` : "transparent"} />
                  <text x={16} y={row.y + 5} fill="var(--muted-foreground)" fontSize={12}>
                    {row.open ? "▾" : "▸"}
                  </text>
                  <text x={32} y={row.y - 2} fill={color} fontSize={12} fontWeight={700}>
                    {t.department[row.department]}
                  </text>
                  <text x={32} y={row.y + 13} fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
                    {`${count} · ${row.done}/${row.total}`.toUpperCase()}
                  </text>
                </g>
              );
            }
            return (
              <g key={row.key}>
                <path d={`M24 ${row.y - 28} V ${row.y} H 34`} fill="none" stroke={color} opacity={0.4} />
                <text x={40} y={row.y + 4} fill="var(--foreground)" fontSize={12}>
                  {short(row.goal, 22)}
                </text>
              </g>
            );
          })}

          {layout.tracks.map((track) => {
            const color = deptColor(track.department);
            const width = track.thin ? 2 : track.row.startsWith("d:") ? 5 : 3;
            return (
              <g key={track.row}>
                <line x1={track.x1 - 30} y1={track.y} x2={track.x2 + 30} y2={track.y} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={0.3} />
                {track.reachedX !== null && (
                  <line
                    x1={track.x1 - 30}
                    y1={track.y}
                    x2={track.reachedX}
                    y2={track.y}
                    stroke={color}
                    strokeWidth={width}
                    strokeLinecap="round"
                    className="map-glow"
                    style={{ color }}
                  />
                )}
                {track.stops.map((x) => (
                  <circle key={x} cx={x} cy={track.y} r={4} fill={color} />
                ))}
              </g>
            );
          })}

          {layout.edges.map((edge) => {
            const from = stationByKey.get(edge.from);
            const to = stationByKey.get(edge.to);
            const lit = !!related && isRelated(from) && isRelated(to);
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
              color={deptColor(station.department)}
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
    <g onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onSelect} className="cursor-pointer transition-opacity" opacity={dimmed ? 0.18 : 1}>
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

export function ActivePanel({
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
          {task.estimated && <span className="rounded-full border border-dashed border-muted-foreground px-2 text-[11px]">{t.estimated}</span>}
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