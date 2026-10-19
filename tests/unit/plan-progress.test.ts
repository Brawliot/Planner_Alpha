import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StoredPlan } from "../../src/lib/plan/orchestrator.ts";
import { setStepStatus, stepActions } from "../../src/lib/plan/progress.ts";
import type { Step } from "../../src/lib/plan/step.ts";
import type { Task } from "../../src/lib/plan/task.ts";

const step = (id: string, extra: Partial<Step> = {}): Step => ({
  id,
  order: 0,
  text: id,
  doneWhen: id,
  suggestedActor: "user",
  allowedActors: ["user", "third_party", "ai"],
  actor: "user",
  effort: { min: 1, max: 1 },
  status: "todo",
  ...extra,
});

const task: Task = {
  id: "t",
  lineId: "l",
  phase: "prepare",
  kind: "action",
  title: "t",
  outcome: "t",
  dependsOn: [],
  basis: [],
  validation: "per_step",
  origin: "catalog",
  steps: [
    step("mine"),
    step("gestor", { actor: "third_party", thirdParty: "advisor", wait: { min: 1, max: 7 } }),
    step("ia", { actor: "ai", aiCapability: "draft_text" }),
  ],
};
const stored: StoredPlan = { lines: [], tasks: [task], dismissed: [], fingerprint: "x" };
const statusOf = (s: StoredPlan | null, id: string) => s?.tasks[0].steps.find((x) => x.id === id)?.status;

describe("setStepStatus", () => {
  it("marca y reabre un paso tuyo", () => {
    const done = setStepStatus(stored, "t", "mine", "done");
    assert.equal(statusOf(done, "mine"), "done");
    assert.equal(statusOf(setStepStatus(done!, "t", "mine", "todo"), "mine"), "todo");
  });

  it("tercero: pedido, recibido, hecho; no se salta pasos", () => {
    assert.equal(setStepStatus(stored, "t", "gestor", "done"), null);
    const requested = setStepStatus(stored, "t", "gestor", "requested");
    assert.equal(statusOf(requested, "gestor"), "requested");
    const received = setStepStatus(requested!, "t", "gestor", "received");
    assert.equal(statusOf(setStepStatus(received!, "t", "gestor", "done"), "gestor"), "done");
  });

  it("la IA no se da por hecha desde aquí; estados inventados, pasos o tareas que no existen: null", () => {
    assert.equal(setStepStatus(stored, "t", "ia", "done"), null);
    assert.equal(setStepStatus(stored, "t", "ia", "ai_draft"), null);
    assert.equal(setStepStatus(stored, "t", "mine", "hecho"), null);
    assert.equal(setStepStatus(stored, "t", "nope", "done"), null);
    assert.equal(setStepStatus(stored, "nope", "mine", "done"), null);
  });
});

describe("stepActions", () => {
  it("botones según actor y estado", () => {
    assert.deepEqual(stepActions("user", "todo"), ["done", "skipped"]);
    assert.deepEqual(stepActions("user", "done"), ["todo"]);
    assert.deepEqual(stepActions("third_party", "todo"), ["skipped", "requested"]);
    assert.deepEqual(stepActions("third_party", "requested"), ["skipped", "received", "todo"]);
    assert.deepEqual(stepActions("ai", "todo"), ["skipped"]);
  });
});