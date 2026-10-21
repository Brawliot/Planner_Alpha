import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
import { TIMELINE, timelineLayout } from "../../src/lib/plan/timeline-chart.ts";
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