import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { metroLayout } from "../../src/lib/plan/metro.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
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
const layout = metroLayout(view);
const allTasks = view.phases.flatMap((p) => [...p.tasks, ...p.done]);

describe("planView para el mapa", () => {
  it("cada tarea apunta a una línea que existe y su progreso es coherente", () => {
    for (const task of allTasks) {
      assert.ok(task.line >= 0 && task.line < view.lines.length, `línea ${task.line} fuera de rango`);
      assert.ok(task.progress.done <= task.progress.total);
    }
  });
});

describe("metroLayout", () => {
  it("una columna por fase y una fila por línea", () => {
    assert.equal(layout.columns.length, view.phases.length);
    assert.equal(layout.rows.length, view.lines.length);
  });

  it("cada tarea está en una sola estación, la de su línea y su fase", () => {
    const placed = layout.stations.flatMap((s) => s.tasks.map((t) => t.id));
    assert.deepEqual([...placed].sort(), allTasks.map((t) => t.id).sort());
    for (const station of layout.stations) {
      for (const t of station.tasks) assert.equal(allTasks.find((x) => x.id === t.id)?.line, station.line);
    }
  });

  it("la estación-grupo se nombra por su tarea principal y cuenta el resto", () => {
    for (const station of layout.stations) {
      assert.equal(station.extra, station.tasks.length - 1);
      assert.ok(station.tasks.some((t) => t.id === station.lead.id));
    }
  });

  it("las dependencias dibujadas cruzan de una línea a otra y no se repiten", () => {
    const keys = layout.edges.map((e) => `${e.from}>${e.to}`);
    assert.equal(new Set(keys).size, keys.length);
    for (const edge of layout.edges) assert.notEqual(edge.from.split("|")[0], edge.to.split("|")[0]);
  });

  it("el tramo recorrido no se sale de la vía", () => {
    for (const track of layout.tracks) {
      if (track.reachedX !== null) assert.ok(track.reachedX >= track.x1 && track.reachedX <= track.x2);
    }
  });
});