import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areasFocus, areasLayout, areasOverview } from "../../src/lib/plan/areas.ts";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
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
const layout = areasLayout(view);
const allTasks = view.phases.flatMap((p) => [...p.tasks, ...p.done]);

describe("areasLayout", () => {
  it("un nodo por departamento, por línea y por tarea", () => {
    assert.equal(layout.departments.length, new Set(view.lines.map((l) => l.department)).size);
    assert.equal(layout.lines.length, view.lines.length);
    assert.deepEqual(layout.tasks.map((t) => t.id).sort(), allTasks.map((t) => t.id).sort());
  });

  it("el progreso de los departamentos suma el del plan", () => {
    assert.equal(layout.departments.reduce((sum, d) => sum + d.total, 0), layout.center.total);
    assert.equal(layout.departments.reduce((sum, d) => sum + d.done, 0), layout.center.done);
  });

  it("cada tarea cuelga de su línea", () => {
    for (const task of layout.tasks) {
      const line = layout.lines.find((l) => l.line === task.line);
      assert.ok(line);
      assert.equal(task.fromX, line.x);
      assert.equal(task.fromY, line.y);
    }
  });

  it("los arcos solo unen departamentos distintos", () => {
    for (const edge of layout.edges) {
      const from = layout.tasks.find((t) => t.id === edge.from)!;
      const to = layout.tasks.find((t) => t.id === edge.to)!;
      assert.notEqual(view.lines[from.line].department, view.lines[to.line].department);
    }
  });
});


describe("areasOverview (todas las áreas)", () => {
  const overview = areasOverview(view);
  const departments = [...new Set(view.lines.map((l) => l.department))];

  it("un nodo por departamento, más grande cuantas más tareas", () => {
    assert.equal(overview.departments.length, departments.length);
    const sorted = [...overview.departments].sort((a, b) => a.total - b.total);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].r >= sorted[i - 1].r);
  });

  it("el desglose de estados suma las tareas de cada departamento", () => {
    for (const d of overview.departments) {
      const { done, doing, waiting, todo } = d.counts;
      assert.equal(done + doing + waiting + todo, d.total);
    }
  });

  it("los enlaces unen departamentos distintos, uno por pareja", () => {
    const keys = overview.links.map((l) => `${l.a}|${l.b}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(overview.links.every((l) => l.a !== l.b && l.count > 0));
  });
});

describe("areasFocus (un departamento)", () => {
  const department = [...new Set(view.lines.map((l) => l.department))][0];
  const focus = areasFocus(view, department);
  const own = allTasks.filter((t) => view.lines[t.line].department === department);

  it("muestra solo las tareas del departamento, una vez cada una", () => {
    assert.deepEqual(focus.tasks.map((t) => t.id).sort(), own.map((t) => t.id).sort());
  });

  it("una pastilla por cada otro departamento", () => {
    assert.ok(focus.pills.every((p) => p.department !== department));
    assert.equal(focus.pills.length, new Set(view.lines.map((l) => l.department)).size - 1);
  });

  it("nada invade el hueco de arriba", () => {
    for (const task of focus.tasks) assert.ok(task.y > focus.pills[0]?.y ?? 0);
  });

  it("una línea exterior por departamento conectado", () => {
    const departments = focus.outer.map((o) => o.department);
    assert.equal(new Set(departments).size, departments.length);
    assert.ok(focus.outer.every((o) => o.count > 0));
  });
});