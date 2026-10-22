"use client";

import { useState } from "react";
import type { PlanTexts } from "@/lib/plan/i18n";
import { areasFocus, areasOverview, type StatusCounts } from "@/lib/plan/areas";
import type { Department } from "@/lib/plan/line";
import type { TaskStatus } from "@/lib/plan/task";
import type { PlanView } from "@/lib/plan/view";
import { ActivePanel, type MetroTask } from "./metro-map";

const deptColor = (department: Department | undefined) => (department ? `var(--dept-${department})` : "var(--muted-foreground)");
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function AreasMap({
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
  // El enfoque no se recuerda: cada vez empieza por todas las áreas.
  const [focus, setFocus] = useState<Department | null>(null);
  const [selected, setSelected] = useState<string | null>(initialTaskId);
  const [hovered, setHovered] = useState<string | null>(null);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const active = byId.get(hovered ?? selected ?? "");
  const unlocksOf = (id: string) => tasks.filter((task) => task.dependsOn.includes(id));
  // Solo se atenúa el resto al pasar el ratón; la tarea fijada en el panel no apaga el mapa.
  const hoveredTask = hovered ? byId.get(hovered) : undefined;
  const related = hoveredTask ? new Set([hoveredTask.id, ...hoveredTask.dependsOn, ...unlocksOf(hoveredTask.id).map((x) => x.id)]) : null;

  const enter = (department: Department | null) => {
    setFocus(department);
    setHovered(null);
    if (department) {
      // Al enfocar, el panel muestra la primera tarea pendiente del departamento.
      const first = tasks.find((task) => view.lines[task.line]?.department === department && task.status !== "done");
      if (first) setSelected(first.id);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-2 overflow-x-auto">
        {focus && (
          <button type="button" onClick={() => enter(null)} className="inline-flex min-h-11 items-center self-start rounded-full px-3 text-sm hover:bg-muted">
            <span aria-hidden="true">←&nbsp;</span>
            {t.overview.allAreas}
          </button>
        )}
        {focus ? (
          <Focus
            view={view}
            department={focus}
            t={t}
            related={related}
            hovered={hovered}
            onHover={setHovered}
            onSelect={setSelected}
            onFocus={enter}
          />
        ) : (
          <Overview view={view} t={t} onFocus={enter} />
        )}
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

function ProgressRing({ x, y, r, frac, color, width }: { x: number; y: number; r: number; frac: number; color: string; width: number }) {
  const end = -Math.PI / 2 + frac * 2 * Math.PI;
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="var(--background)" stroke="var(--border)" strokeWidth={width} />
      {frac >= 1 ? (
        <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={width} className="map-glow" style={{ color }} />
      ) : frac > 0 ? (
        <path
          d={`M${x} ${y - r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x + Math.cos(end) * r} ${y + Math.sin(end) * r}`}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          className="map-glow"
          style={{ color }}
        />
      ) : null}
    </>
  );
}

/** Mini barra de estados: hechas (lima), en curso (blanco), esperando (azul), por hacer (gris). */
function StatusBar({ x, y, counts, total }: { x: number; y: number; counts: StatusCounts; total: number }) {
  const width = 64;
  const parts = [
    { n: counts.done, color: "var(--accent)" },
    { n: counts.doing, color: "var(--foreground)" },
    { n: counts.waiting, color: "var(--info)" },
    { n: counts.todo, color: "var(--input)" },
  ];
  let offset = x - width / 2;
  return (
    <>
      {parts.map((part, i) => {
        if (part.n === 0 || total === 0) return null;
        const w = (width * part.n) / total;
        const rect = <rect key={i} x={offset} y={y} width={Math.max(w - 1.5, 1)} height={5} rx={2} fill={part.color} />;
        offset += w;
        return rect;
      })}
    </>
  );
}

function Overview({ view, t, onFocus }: { view: PlanView; t: PlanTexts; onFocus: (department: Department) => void }) {
  const layout = areasOverview(view);
  const { center } = layout;
  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" style={{ minWidth: layout.width * 0.75 }} className="block" aria-hidden="true">
      <circle cx={center.x} cy={center.y} r={210} fill="none" stroke="var(--border)" strokeDasharray="2 6" />

      {layout.links.map((link) => (
        <g key={`${link.a}|${link.b}`}>
          <path
            d={`M${link.from.x} ${link.from.y} Q ${link.control.x} ${link.control.y} ${link.to.x} ${link.to.y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1 + Math.min(link.count, 4)}
            opacity={0.45}
            className="map-flow"
          />
          <circle cx={link.badge.x} cy={link.badge.y} r={10} fill="var(--background)" stroke="var(--accent)" />
          <text x={link.badge.x} y={link.badge.y + 4} textAnchor="middle" fill="var(--accent)" fontSize={10} fontWeight={700}>
            {link.count}
          </text>
        </g>
      ))}

      <circle cx={center.x} cy={center.y} r={50} fill="var(--background)" stroke="var(--accent)" strokeWidth={1.5} className="map-glow" style={{ color: "var(--accent)" }} />
      <text x={center.x} y={center.y - 2} textAnchor="middle" fill="var(--foreground)" fontSize={13} fontWeight={700}>
        {t.title}
      </text>
      <text x={center.x} y={center.y + 14} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
        {center.done}/{center.total}
      </text>

      {layout.departments.map((d) => {
        const color = deptColor(d.department);
        return (
          <g key={d.department} data-area={d.department} onClick={() => onFocus(d.department)} className="cursor-pointer">
            <circle cx={d.x} cy={d.y} r={d.r + 14} fill="transparent" />
            <ProgressRing x={d.x} y={d.y} r={d.r} frac={d.total === 0 ? 0 : d.done / d.total} color={color} width={5} />
            <text x={d.x} y={d.y + 5} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontWeight={700}>
              {d.done}/{d.total}
            </text>
            <text x={d.x} y={d.y - d.r - 12} textAnchor="middle" fill={color} fontSize={12} fontWeight={700}>
              {t.department[d.department]}
            </text>
            <StatusBar x={d.x} y={d.y + d.r + 10} counts={d.counts} total={d.total} />
          </g>
        );
      })}

      <text x={center.x} y={layout.height - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11}>
        {t.overview.areasHint}
      </text>
    </svg>
  );
}

function Focus({
  view,
  department,
  t,
  related,
  hovered,
  onHover,
  onSelect,
  onFocus,
}: {
  view: PlanView;
  department: Department;
  t: PlanTexts;
  related: Set<string> | null;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onFocus: (department: Department) => void;
}) {
  const layout = areasFocus(view, department);
  const { center } = layout;
  const color = deptColor(department);
  const dim = (id: string) => !!related && !related.has(id);

  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" style={{ minWidth: layout.width * 0.75 }} className="block" aria-hidden="true">
      {layout.pills.map((pill) => (
        <g key={pill.department} onClick={() => onFocus(pill.department)} className="cursor-pointer">
          <rect
            x={pill.x - pill.width / 2}
            y={pill.y - 14}
            width={pill.width}
            height={28}
            rx={14}
            fill="var(--background)"
            stroke={deptColor(pill.department)}
            strokeOpacity={0.6}
          />
          <text x={pill.x} y={pill.y + 4} textAnchor="middle" fill={deptColor(pill.department)} fontSize={11}>
            {short(t.department[pill.department], 14)} {pill.done}/{pill.total}
          </text>
        </g>
      ))}

      {layout.outer.map((link) => {
        const mid = { x: (link.from.x + link.to.x) / 2, y: (link.from.y + link.to.y) / 2 };
        return (
          <g key={link.department}>
            <path
              d={`M${link.from.x} ${link.from.y} Q ${mid.x} ${mid.y + 40} ${link.to.x} ${link.to.y}`}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeDasharray="3 4"
              opacity={0.7}
            />
            <circle cx={mid.x} cy={mid.y + 20} r={10} fill="var(--background)" stroke="var(--muted-foreground)" />
            <text x={mid.x} y={mid.y + 24} textAnchor="middle" fill="var(--foreground)" fontSize={10} fontWeight={700}>
              {link.count}
            </text>
          </g>
        );
      })}

      {layout.objectives.map((o) => (
        <line key={`c-${o.line}`} x1={center.x} y1={center.y} x2={o.x} y2={o.y} stroke={color} strokeWidth={1.5} opacity={0.6} />
      ))}
      {layout.tasks.map((task) => (
        <line key={`l-${task.id}`} x1={task.from.x} y1={task.from.y} x2={task.x} y2={task.y} stroke={color} opacity={dim(task.id) ? 0.08 : 0.35} />
      ))}
      {layout.inner.map((edge) => {
        const lit = !!related && related.has(edge.from) && related.has(edge.to);
        return (
          <path
            key={`${edge.from}>${edge.to}`}
            d={`M${edge.a.x} ${edge.a.y} Q ${center.x} ${center.y} ${edge.b.x} ${edge.b.y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={lit ? 1.6 : 1}
            opacity={related && !lit ? 0.1 : 0.6}
            className="map-flow"
          />
        );
      })}

      <ProgressRing x={center.x} y={center.y} r={52} frac={center.total === 0 ? 0 : center.done / center.total} color={color} width={6} />
      <text x={center.x} y={center.y - 4} textAnchor="middle" fill={color} fontSize={13} fontWeight={700}>
        {short(t.department[department], 16)}
      </text>
      <text x={center.x} y={center.y + 14} textAnchor="middle" fill="var(--foreground)" fontSize={12} fontFamily="var(--font-mono)">
        {center.done}/{center.total}
      </text>

      {layout.objectives.map((o) => (
        <g key={`o-${o.line}`}>
          <rect x={o.x - 7} y={o.y - 7} width={14} height={14} rx={3} fill="var(--background)" stroke={color} strokeWidth={2} transform={`rotate(45 ${o.x} ${o.y})`} />
          <text x={o.x + (o.right ? 14 : -14)} y={o.y - 12} textAnchor={o.right ? "start" : "end"} fill="var(--foreground)" fontSize={13} fontWeight={600}>
            {short(o.goal, 30)}
          </text>
        </g>
      ))}

      {layout.tasks.map((task) => (
        <g
          key={task.id}
          onMouseEnter={() => onHover(task.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSelect(task.id)}
          className="cursor-pointer transition-opacity"
          opacity={dim(task.id) ? 0.18 : 1}
        >
          <circle cx={task.x} cy={task.y} r={18} fill="transparent" />
          <TaskDot x={task.x} y={task.y} status={task.status} color={color} />
          {(task.label || hovered === task.id) && (
            <text x={task.x + (task.right ? 18 : -18)} y={task.y + 4} textAnchor={task.right ? "start" : "end"} fill="var(--muted-foreground)" fontSize={11}>
              {short(task.title, 34)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Hecha (rellena con ✓), en curso (brilla y late), esperando (discontinua), por hacer (hueca), bloqueada (tenue). */
function TaskDot({ x, y, status, color }: { x: number; y: number; status: TaskStatus; color: string }) {
  const done = status === "done";
  return (
    <>
      {status === "doing" && <circle cx={x} cy={y} r={10} fill="none" stroke={color} strokeWidth={2} className="map-pulse" />}
      <circle
        cx={x}
        cy={y}
        r={10}
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