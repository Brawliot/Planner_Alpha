import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

describe("planView", () => {
  it("fases en orden y solo las que tienen tareas", () => {
    const order = ["validate", "prepare", "launch", "operate"];
    const phases = view.phases.map((p) => p.phase);
    assert.deepEqual(phases, [...phases].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    assert.ok(view.phases.every((p) => p.tasks.length > 0));
  });

  it("cada tarea con semanas, fechas, departamento y pasos", () => {
    for (const task of view.phases.flatMap((p) => p.tasks)) {
      assert.ok(task.weeks.from >= 1 && task.weeks.to >= task.weeks.from);
      assert.match(task.dates.from, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(task.department);
      assert.ok(task.steps.length > 0);
    }
  });

  it("decisiones con nombres legibles, no ids", () => {
    for (const d of view.decisions) {
      assert.ok(d.options.every((o) => !o.includes("_")));
      assert.ok(d.options.includes(d.chosen));
    }
  });

  it("no manda datos internos", () => {
    const json = JSON.stringify(view);
    assert.ok(!json.includes("fingerprint"));
    assert.ok(!json.includes('"log"'));
    assert.ok(!json.includes("lineId"));
  });

  it("el formulario refleja la configuración", () => {
    assert.equal(view.form.startDate, config.startDate);
    assert.deepEqual(view.form.delegation, config.delegation);
  });
});