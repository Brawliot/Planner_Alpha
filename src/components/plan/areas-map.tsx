"use client";

import { useEffect, useRef, useState } from "react";
import { fillText, type PlanTexts } from "@/lib/plan/i18n";
import { areasTree, areasWheel, type AreaSignal, type AreasTree } from "@/lib/plan/areas-tree";
import type { Department } from "@/lib/plan/line";
import type { TaskStatus } from "@/lib/plan/task";
import type { PlanView } from "@/lib/plan/view";
import type { MetroTask } from "./metro-map";

const deptColor = (department: Department | undefined) => (department ? `var(--dept-${department})` : "var(--muted-foreground)");
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Giro de la rueda: desplazamiento del centro y rotación en grados. */
type Pose = { tx: number; ty: number; rot: number };
const DURATION = 750;
const CARD = 270;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function AreasMap({
  view,
  t,
  hovered,
  onHover,
  onSelect,
}: {
  view: PlanView;
  tasks: MetroTask[];
  t: PlanTexts;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const wheel = areasWheel(view);
  // El enfoque no se recuerda: cada vez empieza por la rueda.
  const [focus, setFocus] = useState<Department | null>(null);
  // Área cuyo árbol se ve: solo cuando el giro ha terminado.
  const [shown, setShown] = useState<Department | null>(null);
  const [pose, setPose] = useState<Pose>({ tx: 0, ty: 0, rot: 0 });
  const poseRef = useRef(pose);
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const go = (target: Department | null) => {
    onHover(null);
    setFocus(target);
    setShown(null);
    const from = poseRef.current;
    let to: Pose = { tx: 0, ty: 0, rot: Math.round(from.rot / 360) * 360 };
    if (target) {
      const node = wheel.departments.find((d) => d.department === target);
      const tree = areasTree(view, target);
      // Giro mínimo para dejar el área a la derecha del centro (ángulo 0).
      let rot = node ? (-node.angle * 180) / Math.PI : from.rot;
      while (rot - from.rot > 180) rot -= 360;
      while (rot - from.rot < -180) rot += 360;
      to = { tx: tree.center.x - wheel.center.x, ty: tree.center.y - wheel.center.y, rot };
    }
    // Una animación nueva cancela la anterior: así nunca se dibujan dos árboles a la vez.
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const step = (now: number) => {
      const k = reduce ? 1 : ease(Math.min(1, (now - start) / DURATION));
      const next = { tx: from.tx + (to.tx - from.tx) * k, ty: from.ty + (to.ty - from.ty) * k, rot: from.rot + (to.rot - from.rot) * k };
      poseRef.current = next;
      setPose(next);
      if (k < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        frame.current = null;
        setShown(target);
      }
    };
    frame.current = requestAnimationFrame(step);
  };

  const tree = focus ? areasTree(view, focus) : null;
  const height = Math.max(wheel.height, tree?.height ?? 0);

  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      {tree && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => go(null)} className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface/80 px-4 text-sm backdrop-blur-md hover:bg-muted">
            <span aria-hidden="true">←&nbsp;</span>
            {t.overview.allAreas}
          </button>
          <div data-rail className="flex flex-wrap gap-1.5">
            {tree.rail.map((area) => (
              <RailButton key={area.department} area={area} active={area.department === focus} t={t} onClick={() => go(area.department)} />
            ))}
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${wheel.width} ${height}`} width="100%" style={{ minWidth: wheel.width * 0.75 }} className="block" aria-hidden="true">
        <Wheel wheel={wheel} pose={pose} focus={focus} t={t} onFocus={go} />
        {tree && shown === focus && <Tree tree={tree} t={t} hovered={hovered} onHover={onHover} onSelect={onSelect} onFocus={go} />}
        {!focus && (
          <text x={wheel.center.x} y={height - 12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={12}>
            {t.overview.areasHint}
          </text>
        )}
      </svg>
    </div>
  );
}

function RailButton({ area, active, t, onClick }: { area: AreaSignal; active: boolean; t: PlanTexts; onClick: () => void }) {
  const color = deptColor(area.department);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{ color }}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border bg-surface/80 px-3 text-xs backdrop-blur-md hover:border-muted-foreground ${active ? "border-current" : "border-border"}`}
    >
      <span className="text-foreground">{t.department[area.department]}</span>
      <span aria-hidden="true" className="h-1 w-7 overflow-hidden rounded-full bg-border">
        <span className="block h-full bg-current" style={{ width: `${area.total === 0 ? 0 : (area.done / area.total) * 100}%` }} />
      </span>
      {area.now > 0 && <span className="font-mono text-[10px] text-accent">{fillText(t.overview.areaNow, { n: area.now })}</span>}
      {area.waiting > 0 && <span className="font-mono text-[10px] text-warning">{fillText(t.overview.areaWaiting, { n: area.waiting })}</span>}
    </button>
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

/** Píldoras "N ahora" y "N esperando", centradas bajo un punto. */
function Signals({ x, y, now, waiting, t }: { x: number; y: number; now: number; waiting: number; t: PlanTexts }) {
  const parts = [
    now > 0 && { label: fillText(t.overview.areaNow, { n: now }), fill: "var(--accent)" },
    waiting > 0 && { label: fillText(t.overview.areaWaiting, { n: waiting }), fill: "var(--warning)" },
  ].filter((p): p is { label: string; fill: string } => !!p);
  const widths = parts.map((p) => p.label.length * 6.4 + 14);
  let offset = x - (widths.reduce((a, b) => a + b, 0) + 6 * (parts.length - 1)) / 2;
  return (
    <>
      {parts.map((part, i) => {
        const left = offset;
        offset += widths[i] + 6;
        return (
          <g key={part.label}>
            <rect x={left} y={y} width={widths[i]} height={20} rx={10} fill={part.fill} />
            <text x={left + widths[i] / 2} y={y + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--background)">
              {part.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Wheel({
  wheel,
  pose,
  focus,
  t,
  onFocus,
}: {
  wheel: ReturnType<typeof areasWheel>;
  pose: Pose;
  focus: Department | null;
  t: PlanTexts;
  onFocus: (department: Department) => void;
}) {
  const { center } = wheel;
  // Los textos se contrarrotan para leerse siempre derechos.
  const upright = (x: number, y: number) => `rotate(${-pose.rot} ${x} ${y})`;
  return (
    <g transform={`translate(${pose.tx} ${pose.ty}) rotate(${pose.rot} ${center.x} ${center.y})`}>
      {wheel.departments.map((d) => (
        <line key={`s-${d.department}`} x1={center.x} y1={center.y} x2={d.x} y2={d.y} stroke={deptColor(d.department)} strokeWidth={2} opacity={0.55} />
      ))}
      {wheel.departments.map((d) => {
        const color = deptColor(d.department);
        return (
          <g
            key={d.department}
            data-area={d.department}
            onClick={() => onFocus(d.department)}
            className="cursor-pointer transition-opacity"
            opacity={focus && focus !== d.department ? 0.22 : 1}
          >
            <circle cx={d.x} cy={d.y} r={d.r + 14} fill="transparent" />
            <ProgressRing x={d.x} y={d.y} r={d.r} frac={d.total === 0 ? 0 : d.done / d.total} color={color} width={5} />
            <g transform={upright(d.x, d.y)}>
              <text x={d.x} y={d.y + 5} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontWeight={700}>
                {d.done}/{d.total}
              </text>
              <text x={d.x} y={d.y - d.r - 12} textAnchor="middle" fill={color} fontSize={12} fontWeight={700}>
                {t.department[d.department]}
              </text>
              {!focus && <Signals x={d.x} y={d.y + d.r + 10} now={d.now} waiting={d.waiting} t={t} />}
            </g>
          </g>
        );
      })}
      <circle cx={center.x} cy={center.y} r={54} fill="var(--background)" stroke="var(--accent)" strokeWidth={1.5} className="map-glow" style={{ color: "var(--accent)" }} />
      <g transform={upright(center.x, center.y)}>
        <text x={center.x} y={center.y - 2} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontWeight={700}>
          {t.title}
        </text>
        <text x={center.x} y={center.y + 15} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-mono)">
          {center.done}/{center.total}
        </text>
      </g>
    </g>
  );
}

function Tree({
  tree,
  t,
  hovered,
  onHover,
  onSelect,
  onFocus,
}: {
  tree: AreasTree;
  t: PlanTexts;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onFocus: (department: Department) => void;
}) {
  const { node } = tree;
  const color = deptColor(node.department);
  const summary = [
    node.counts.doing > 0 && fillText(t.overview.areaDoing, { n: node.counts.doing }),
    node.counts.waiting > 0 && fillText(t.overview.areaWaiting, { n: node.counts.waiting }),
    node.counts.todo > 0 && fillText(t.overview.areaTodo, { n: node.counts.todo }),
  ].filter(Boolean);

  return (
    <g className="map-fade-in">
      {summary.length > 0 && (
        <text x={node.x} y={node.y + node.r + 26} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11}>
          {summary.join(" · ")}
        </text>
      )}

      {tree.objectives.map((o) => (
        <path
          key={`b-${o.line}`}
          d={`M${node.x + node.r + 8} ${node.y} C ${node.x + 130} ${node.y}, ${o.x - 110} ${o.y}, ${o.x - 12} ${o.y}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.7}
        />
      ))}
      {tree.tasks.map((task) => (
        <path
          key={`l-${task.id}`}
          d={`M${task.from.x + 12} ${task.from.y} C ${task.from.x + 140} ${task.from.y}, ${task.x - 130} ${task.y}, ${task.x - 18} ${task.y}`}
          fill="none"
          stroke={color}
          opacity={0.4}
        />
      ))}

      {tree.objectives.map((o) => (
        <g key={`o-${o.line}`}>
          <ProgressRing x={o.x} y={o.y} r={11} frac={o.total === 0 ? 0 : o.done / o.total} color={color} width={3} />
          <text x={o.x + 20} y={o.y - 3} fill="var(--foreground)" fontSize={13} fontWeight={600}>
            {short(o.goal, 26)}
          </text>
          <text x={o.x + 20} y={o.y + 13} fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">
            {fillText(t.overview.objectiveTasks, { done: o.done, total: o.total })}
          </text>
        </g>
      ))}

      {tree.tasks.map((task) => {
        const blocker = task.blockedBy[0];
        const label = task.now !== null ? t.overview.nowTag : t.overview.areaStatus[task.status];
        const labelColor = task.now !== null ? "var(--accent)" : task.status === "waiting" || task.status === "blocked" ? "var(--warning)" : "var(--muted-foreground)";
        const right = task.x - 18 + CARD;
        return (
          <g
            key={task.id}
            onMouseEnter={() => onHover(task.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(task.id)}
            className="cursor-pointer"
          >
            <rect
              x={task.x - 18}
              y={task.y - 18}
              width={CARD}
              height={36}
              rx={18}
              fill="var(--surface)"
              stroke={hovered === task.id ? "var(--foreground)" : task.now !== null ? "var(--accent)" : "var(--border)"}
            />
            <TaskDot x={task.x} y={task.y} status={task.status} color={color} />
            <text x={task.x + 20} y={task.y + 4} fontSize={13} fill={task.status === "done" ? "var(--muted-foreground)" : "var(--foreground)"}>
              {short(task.title, 24)}
            </text>
            <text x={right - 14} y={task.y + 4} textAnchor="end" fontSize={9} letterSpacing="0.08em" fontFamily="var(--font-mono)" fill={labelColor}>
              {label.toUpperCase()}
            </text>
            {task.now !== null && (
              <>
                <circle cx={right} cy={task.y - 16} r={8} fill="var(--accent)" />
                <text x={right} y={task.y - 12.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--accent-foreground)">
                  {task.now}
                </text>
              </>
            )}
            {blocker && (
              <BlockerTag
                x={right}
                y={task.y}
                text={`${t.department[blocker.department]}: ${short(blocker.title, 26)}${task.blockedBy.length > 1 ? ` +${task.blockedBy.length - 1}` : ""}`}
                title={fillText(t.overview.waitsFor, { area: t.department[blocker.department], task: blocker.title })}
                color={deptColor(blocker.department)}
                onClick={() => onFocus(blocker.department)}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Etiqueta discontinua con el área y la tarea de la que se espera; al pulsarla se va a esa área. */
function BlockerTag({ x, y, text, title, color, onClick }: { x: number; y: number; text: string; title: string; color: string; onClick: () => void }) {
  const width = text.length * 6.2 + 34;
  return (
    <g
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="cursor-pointer"
    >
      <title>{title}</title>
      <path d={`M${x} ${y} H ${x + 14}`} stroke={color} strokeDasharray="3 3" />
      <rect x={x + 14} y={y - 13} width={width} height={26} rx={13} fill="var(--background)" stroke={color} strokeOpacity={0.6} strokeDasharray="3 3" />
      <text x={x + 26} y={y + 4} fontSize={11} fill={color}>
        ⛓ {text}
      </text>
    </g>
  );
}

/** Hecha (rellena con ✓), en curso (brilla y late), esperando (discontinua), por hacer (hueca), bloqueada (discontinua en aviso). */
function TaskDot({ x, y, status, color }: { x: number; y: number; status: TaskStatus; color: string }) {
  const done = status === "done";
  const stroke = status === "blocked" ? "var(--warning)" : color;
  return (
    <>
      {status === "doing" && <circle cx={x} cy={y} r={9} fill="none" stroke={color} strokeWidth={2} className="map-pulse" />}
      <circle
        cx={x}
        cy={y}
        r={9}
        fill={done ? color : "var(--background)"}
        stroke={stroke}
        strokeWidth={2.5}
        strokeDasharray={status === "waiting" || status === "blocked" ? "3 3" : undefined}
        className={status === "doing" ? "map-glow" : undefined}
        style={{ color }}
      />
      {done && <path d={`M${x - 4} ${y}l3 3 5-6`} stroke="var(--background)" strokeWidth={2} fill="none" strokeLinecap="round" />}
    </>
  );
}