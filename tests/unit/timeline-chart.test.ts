import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
import { TIMELINE, timelineGroups } from "../../src/lib/plan/timeline-chart.ts";
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
const pending = view.phases.flatMap((p) => p.tasks);
const departments = [...new Set(view.lines.map((l) => l.department))];
const xOf = (day: number) => TIMELINE.left + (day / 7) * TIMELINE.weekWidth;

describe("timelineGroups", () => {
  it("plegado: solo filas de departamento; sus tramos cubren sus tareas pendientes", () => {
    const grouped = timelineGroups(view, config.startDate);
    assert.equal(grouped.rows.length, departments.length);
    for (const row of grouped.rows) {
      assert.ok(row.kind === "department" && !row.open);
      if (row.kind !== "department") continue;
      for (const task of pending.filter((t) => view.lines[t.line].department === row.department)) {
        assert.ok(
          row.segments.some((s) => s.x1 <= xOf(task.schedule.start) + 0.001 && s.xMax >= xOf(task.schedule.endMax) - 0.001),
          `${task.id} fuera de los tramos de ${row.department}`,
        );
      }
    }
  });

  it("desplegado: objetivos y, debajo, todas las tareas pendientes del departamento", () => {
    const open = departments[0];
    const grouped = timelineGroups(view, config.startDate, new Set([open]));
    const own = pending.filter((t) => view.lines[t.line].department === open);
    const taskIds = grouped.rows.flatMap((r) => (r.kind === "task" ? [r.id] : []));
    assert.deepEqual([...taskIds].sort(), own.map((t) => t.id).sort());
    if (own.length > 0) assert.ok(grouped.rows.some((r) => r.kind === "objective"));
  });

  it("cada barra de tarea: inicio ≤ fin seguro ≤ fin estimado", () => {
    const grouped = timelineGroups(view, config.startDate, new Set(departments));
    for (const row of grouped.rows) {
      if (row.kind === "task") assert.ok(row.x1 <= row.xMin && row.xMin <= row.xMax, row.id);
    }
  });

  it("las dependencias unen filas distintas y no se repiten", () => {
    const grouped = timelineGroups(view, config.startDate, new Set(departments.slice(0, 1)));
    const keys = grouped.edges.map((e) => `${e.from}@${e.x1}>${e.to}@${e.x2}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(grouped.edges.every((e) => e.from !== e.to));
  });

  it("hoy: en el día de inicio está al principio; antes del inicio no se dibuja", () => {
    assert.equal(timelineGroups(view, config.startDate).todayX, TIMELINE.left);
    assert.equal(timelineGroups(view, "2000-01-01").todayX, null);
  });
});