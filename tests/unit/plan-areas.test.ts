import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areasFocus, areasOverview } from "../../src/lib/plan/areas.ts";
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
const allTasks = view.phases.flatMap((p) => [...p.tasks, ...p.done]);
const departments = [...new Set(view.lines.map((l) => l.department))];

describe("areasOverview (todas las áreas)", () => {
  const overview = areasOverview(view);

  it("un nodo por departamento, más grande cuantas más tareas", () => {
    assert.equal(overview.departments.length, departments.length);
    const sorted = [...overview.departments].sort((a, b) => a.total - b.total);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].r >= sorted[i - 1].r);
  });

  it("los departamentos suman las tareas del plan", () => {
    assert.equal(overview.departments.reduce((sum, d) => sum + d.total, 0), overview.center.total);
    assert.equal(overview.departments.reduce((sum, d) => sum + d.done, 0), overview.center.done);
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
  const department = departments[0];
  const focus = areasFocus(view, department);
  const own = allTasks.filter((t) => view.lines[t.line].department === department);

  it("muestra solo las tareas del departamento, una vez cada una", () => {
    assert.deepEqual(focus.tasks.map((t) => t.id).sort(), own.map((t) => t.id).sort());
  });

  it("una pastilla por cada otro departamento", () => {
    assert.ok(focus.pills.every((p) => p.department !== department));
    assert.equal(focus.pills.length, departments.length - 1);
  });

  it("nada invade la fila de pastillas", () => {
    const pillY = focus.pills[0]?.y ?? 0;
    for (const task of focus.tasks) assert.ok(task.y > pillY);
  });

  it("una línea exterior por departamento conectado", () => {
    const connected = focus.outer.map((o) => o.department);
    assert.equal(new Set(connected).size, connected.length);
    assert.ok(focus.outer.every((o) => o.count > 0));
  });
});