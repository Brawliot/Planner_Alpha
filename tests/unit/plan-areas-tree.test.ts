import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AREAS_WHEEL, areasTree, areasWheel } from "../../src/lib/plan/areas-tree.ts";
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
const departmentOf = (id: string) => view.lines[allTasks.find((t) => t.id === id)!.line].department;

describe("areasWheel (la rueda)", () => {
  const wheel = areasWheel(view);

  it("un nodo por departamento, sobre el anillo", () => {
    assert.equal(wheel.departments.length, departments.length);
    for (const d of wheel.departments) {
      assert.ok(Math.abs(Math.hypot(d.x - wheel.center.x, d.y - wheel.center.y) - AREAS_WHEEL.ring) < 0.001);
    }
  });

  it("los departamentos suman las tareas del plan", () => {
    assert.equal(wheel.departments.reduce((sum, d) => sum + d.total, 0), wheel.center.total);
    assert.equal(wheel.departments.reduce((sum, d) => sum + d.done, 0), wheel.center.done);
  });

  it("las señales de \"ahora\" suman la lista Ahora del plan", () => {
    assert.equal(wheel.departments.reduce((sum, d) => sum + d.now, 0), view.now.length);
  });

  it("\"esperando\" cuenta las tareas que esperan o están bloqueadas", () => {
    for (const d of wheel.departments) {
      const own = allTasks.filter((t) => view.lines[t.line].department === d.department);
      assert.equal(d.waiting, own.filter((t) => t.status === "waiting" || t.status === "blocked").length);
    }
  });
});

describe("areasTree (un área abierta en árbol)", () => {
  for (const department of departments) {
    const tree = areasTree(view, department);
    const own = allTasks.filter((t) => view.lines[t.line].department === department);

    it(`${department}: todas sus tareas, una vez cada una`, () => {
      assert.deepEqual(tree.tasks.map((t) => t.id).sort(), own.map((t) => t.id).sort());
    });

    it(`${department}: el área queda a la derecha del centro, cortado por el borde`, () => {
      assert.equal(tree.center.x, AREAS_WHEEL.focusCenterX);
      assert.equal(tree.node.y, tree.center.y);
      assert.ok(tree.node.x > tree.center.x);
    });

    it(`${department}: columnas ordenadas (área → objetivos → tareas) y filas sin solaparse`, () => {
      for (const o of tree.objectives) assert.ok(o.x > tree.node.x);
      for (const t of tree.tasks) assert.ok(t.x > t.from.x);
      const ys = tree.tasks.map((t) => t.y);
      for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= AREAS_WHEEL.rowHeight - 0.001);
    });

    it(`${department}: todo cabe en el lienzo`, () => {
      for (const t of tree.tasks) assert.ok(t.y > 0 && t.y < tree.height);
    });

    it(`${department}: los objetivos suman las tareas del área`, () => {
      assert.equal(tree.objectives.reduce((sum, o) => sum + o.total, 0), own.length);
    });

    it(`${department}: los bloqueos solo vienen de otras áreas y siguen pendientes`, () => {
      for (const t of tree.tasks) {
        if (t.status === "done") assert.equal(t.blockedBy.length, 0);
        for (const b of t.blockedBy) {
          assert.notEqual(b.department, department);
          assert.equal(departmentOf(b.taskId), b.department);
          assert.notEqual(allTasks.find((x) => x.id === b.taskId)!.status, "done");
        }
      }
    });

    it(`${department}: los números de "ahora" son los de la lista Ahora`, () => {
      for (const t of tree.tasks) {
        const index = view.now.findIndex((n) => n.taskId === t.id);
        assert.equal(t.now, index === -1 ? null : index + 1);
      }
    });

    it(`${department}: el riel tiene todas las áreas`, () => {
      assert.deepEqual(tree.rail.map((r) => r.department), departments);
    });
  }
});