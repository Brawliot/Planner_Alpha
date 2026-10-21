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
const allTasks = view.phases.flatMap((p) => [...p.tasks, ...p.done]);
const departments = [...new Set(view.lines.map((l) => l.department))];

describe("planView para el mapa", () => {
  it("cada tarea apunta a una línea que existe y su progreso es coherente", () => {
    for (const task of allTasks) {
      assert.ok(task.line >= 0 && task.line < view.lines.length, `línea ${task.line} fuera de rango`);
      assert.ok(task.progress.done <= task.progress.total);
    }
  });
});

describe("metroLayout plegado", () => {
  const layout = metroLayout(view);

  it("una fila por departamento, sin filas de objetivos", () => {
    assert.equal(layout.rows.length, departments.length);
    assert.ok(layout.rows.every((r) => r.kind === "department" && !r.open));
  });

  it("cada tarea está en una sola estación, la de su departamento", () => {
    const placed = layout.stations.flatMap((s) => s.tasks.map((t) => t.id));
    assert.deepEqual([...placed].sort(), allTasks.map((t) => t.id).sort());
    for (const station of layout.stations) {
      for (const t of station.tasks) {
        const task = allTasks.find((x) => x.id === t.id)!;
        assert.equal(view.lines[task.line].department, station.department);
      }
    }
  });

  it("la estación se nombra por su tarea principal y cuenta el resto", () => {
    for (const station of layout.stations) {
      assert.equal(station.extra, station.tasks.length - 1);
      assert.ok(station.tasks.some((t) => t.id === station.lead.id));
    }
  });
});

describe("metroLayout desplegado", () => {
  const open = departments[0];
  const layout = metroLayout(view, new Set([open]));

  it("el departamento abierto muestra sus objetivos y no tiene estaciones propias", () => {
    const lines = view.lines.filter((l) => l.department === open).length;
    assert.equal(layout.rows.filter((r) => r.kind === "line").length, lines);
    assert.ok(!layout.stations.some((s) => s.row === `d:${open}`));
    assert.ok(layout.tracks.find((t) => t.row === `d:${open}`)?.thin);
  });

  it("todas las tareas siguen colocadas una sola vez", () => {
    const placed = layout.stations.flatMap((s) => s.tasks.map((t) => t.id));
    assert.deepEqual([...placed].sort(), allTasks.map((t) => t.id).sort());
  });

  it("las dependencias unen filas distintas y no se repiten", () => {
    const keys = layout.edges.map((e) => `${e.from}>${e.to}`);
    assert.equal(new Set(keys).size, keys.length);
    for (const edge of layout.edges) assert.notEqual(edge.from.split("|")[0], edge.to.split("|")[0]);
  });
});