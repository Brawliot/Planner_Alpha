import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
import { TIMELINE, timelineGroups, timelineLayout } from "../../src/lib/plan/timeline-chart.ts";
import { planView } from "../../src/lib/plan/view.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";
import { EXAMPLES } from "../../scripts/plan-examples.ts";

const { facts, config: extra } = EXAMPLES.cafe;
const today = "2026-10-19";
const config = { ...prefillConfig(facts, today).config, ...extra };
const state = rebuildPlan({
  report: { facts, verdicts: areaVerdicts(facts), language: "es", fingerprint: "test" },
  config,
  catalog: MOLDS,
  stored: null,
  today,
});
const view = planView({ state, config, catalog: MOLDS, facts, language: "es" });
const layout = timelineLayout(view, config.startDate);
const pending = view.phases.flatMap((p) => p.tasks);
const taskRows = layout.rows.filter((r) => r.kind === "task");

describe("timelineLayout", () => {
  it("una fila por tarea pendiente, bajo la cabecera de su departamento", () => {
    assert.deepEqual(taskRows.map((r) => r.id).sort(), pending.map((t) => t.id).sort());
    let department: string | null = null;
    for (const row of layout.rows) {
      if (row.kind === "department") department = row.department;
      else assert.equal(row.task.department, department);
    }
  });

  it("cada barra: inicio ≤ fin seguro ≤ fin estimado", () => {
    for (const row of taskRows) {
      if (row.kind !== "task") continue;
      assert.ok(row.x1 <= row.xMin && row.xMin <= row.xMax, row.id);
    }
  });

  it("hay semanas hasta el final más tardío y la apertura cabe", () => {
    const lastX = layout.weeks.at(-1)!.x + TIMELINE.weekWidth;
    for (const row of taskRows) if (row.kind === "task") assert.ok(row.xMax <= lastX + 0.001);
    if (layout.opening) assert.ok(layout.opening.x2 <= lastX + 0.001);
  });

  it("hoy: en el día de inicio está al principio; antes del inicio no se dibuja", () => {
    assert.equal(layout.todayX, TIMELINE.left);
    assert.equal(timelineLayout(view, "2000-01-01").todayX, null);
  });

  it("las dependencias van del fin seguro de una tarea al inicio de la siguiente", () => {
    for (const edge of layout.edges) {
      const from = taskRows.find((r) => r.id === edge.from);
      const to = taskRows.find((r) => r.id === edge.to);
      assert.ok(from && to && from.kind === "task" && to.kind === "task");
      assert.equal(edge.x1, from.xMin);
      assert.equal(edge.x2, to.x1);
    }
  });
});


describe("timelineGroups", () => {
  const departments = [...new Set(view.lines.map((l) => l.department))];

  it("plegado: solo filas de departamento; sus tramos cubren sus tareas pendientes", () => {
    const grouped = timelineGroups(view, config.startDate);
    assert.ok(grouped.rows.every((r) => r.kind === "department" && !r.open));
    for (const row of grouped.rows) {
      if (row.kind !== "department") continue;
      for (const task of pending.filter((t) => view.lines[t.line].department === row.department)) {
        const x1 = TIMELINE.left + (task.schedule.start / 7) * TIMELINE.weekWidth;
        const xMax = TIMELINE.left + (task.schedule.endMax / 7) * TIMELINE.weekWidth;
        assert.ok(
          row.segments.some((s) => s.x1 <= x1 + 0.001 && s.xMax >= xMax - 0.001),
          `${task.id} fuera de los tramos de ${row.department}`,
        );
      }
    }
  });

  it("desplegado: objetivos y, debajo, todas las tareas pendientes del departamento", () => {
    const open = departments[0];
    const grouped = timelineGroups(view, config.startDate, new Set([open]));
    const own = pending.filter((t) => view.lines[t.line].department === open);
    const taskRows = grouped.rows.filter((r) => r.kind === "task");
    assert.deepEqual(taskRows.map((r) => (r.kind === "task" ? r.id : "")).sort(), own.map((t) => t.id).sort());
    assert.ok(grouped.rows.some((r) => r.kind === "objective"));
  });

  it("las dependencias unen filas distintas y no se repiten", () => {
    const grouped = timelineGroups(view, config.startDate, new Set(departments.slice(0, 1)));
    const keys = grouped.edges.map((e) => `${e.from}@${e.x1}>${e.to}@${e.x2}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(grouped.edges.every((e) => e.from !== e.to));
  });
});