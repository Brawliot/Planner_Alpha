import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
import { taskPageView } from "../../src/lib/plan/task-view.ts";
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
const ordered = view.phases.flatMap((p) => [...p.tasks, ...p.done]);

describe("taskPageView", () => {
  it("una tarea que no existe da null", () => {
    assert.equal(taskPageView(view, state, "no-existe"), null);
  });

  it("posición, anterior y siguiente en el orden del plan", () => {
    const first = taskPageView(view, state, ordered[0].id);
    assert.deepEqual(first?.position, { index: 1, total: ordered.length });
    assert.equal(first?.previous, null);
    assert.equal(first?.next?.id, ordered[1].id);

    const last = taskPageView(view, state, ordered.at(-1)!.id);
    assert.equal(last?.next, null);
    assert.equal(last?.previous?.id, ordered.at(-2)!.id);
  });

  it("antes y desbloquea salen de las dependencias, en los dos sentidos", () => {
    for (const task of state.tasks.filter((t) => t.archived === undefined)) {
      const page = taskPageView(view, state, task.id);
      if (!page) continue;
      assert.deepEqual(page.before.map((l) => l.id).sort(), [...task.dependsOn].sort());
      for (const unlocked of page.unlocks) {
        assert.ok(state.tasks.find((t) => t.id === unlocked.id)?.dependsOn.includes(task.id));
      }
    }
  });

  it("paso actual = primero sin resolver; resumen coherente con los pasos", () => {
    const page = taskPageView(view, state, ordered[0].id)!;
    const firstOpen = page.task.steps.find((s) => s.status !== "done" && s.status !== "skipped");
    assert.equal(page.currentStepId, firstOpen?.id ?? null);
    assert.equal(page.summary.total, page.task.steps.length);
    assert.ok(page.summary.userHours.min <= page.summary.userHours.max);
  });

  it("los pasos llevan 'está hecho cuando'", () => {
    const page = taskPageView(view, state, ordered[0].id)!;
    assert.ok(page.task.steps.every((s) => s.doneWhen.length > 0));
  });
});