import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findCycle } from "../../src/lib/plan/graph.ts";
import type { Step } from "../../src/lib/plan/step.ts";
import {
  stepOutOfOrder,
  taskGraphIssues,
  taskOutOfOrder,
  taskSchema,
  taskStatus,
  taskTotals,
  type Task,
} from "../../src/lib/plan/task.ts";

function userStep(id: string, extra: Partial<Step> = {}): Step {
  return {
    id,
    order: 0,
    text: id,
    doneWhen: id,
    suggestedActor: "user",
    allowedActors: ["user", "third_party"],
    actor: "user",
    effort: { min: 1, max: 2 },
    status: "todo",
    ...extra,
  };
}

function thirdStep(id: string, extra: Partial<Step> = {}): Step {
  return {
    ...userStep(id),
    actor: "third_party",
    effort: { min: 0.5, max: 0.5 },
    thirdParty: "advisor",
    wait: { min: 3, max: 7 },
    cost: { min: 50, max: 150 },
    ...extra,
  };
}

function task(id: string, steps: Step[], extra: Partial<Task> = {}): Task {
  return {
    id,
    lineId: "line",
    phase: "prepare",
    kind: "action",
    title: id,
    outcome: id,
    dependsOn: [],
    basis: [],
    validation: "per_step",
    steps,
    ...extra,
  };
}

const valid = (value: unknown) => taskSchema.safeParse(value).success;

describe("findCycle", () => {
  it("detecta ciclos y autodependencias", () => {
    assert.deepEqual(findCycle([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }]), ["a", "b", "a"]);
    assert.deepEqual(findCycle([{ id: "a", dependsOn: ["a"] }]), ["a", "a"]);
    assert.equal(findCycle([{ id: "a" }, { id: "b", dependsOn: ["a"] }]), null);
  });
});

describe("taskSchema", () => {
  it("acepta una tarea válida", () => {
    assert.ok(valid(task("t", [userStep("a"), userStep("b", { dependsOn: ["a"] })])));
  });

  it("rechaza ids de paso repetidos, dependencias desconocidas y ciclos entre pasos", () => {
    assert.ok(!valid(task("t", [userStep("a"), userStep("a")])));
    assert.ok(!valid(task("t", [userStep("a", { dependsOn: ["x"] })])));
    assert.ok(!valid(task("t", [userStep("a", { dependsOn: ["b"] }), userStep("b", { dependsOn: ["a"] })])));
  });

  it("rechaza una tarea sin pasos o que depende de sí misma", () => {
    assert.ok(!valid(task("t", [])));
    assert.ok(!valid(task("t", [userStep("a")], { dependsOn: ["t"] })));
  });
});

describe("taskGraphIssues", () => {
  it("avisa de tareas inexistentes y ciclos", () => {
    assert.deepEqual(taskGraphIssues([task("a", [userStep("s")], { dependsOn: ["zz"] })]), ["a → zz"]);
    const cyclic = [task("a", [userStep("s")], { dependsOn: ["b"] }), task("b", [userStep("s")], { dependsOn: ["a"] })];
    assert.equal(taskGraphIssues(cyclic).length, 1);
  });
});

describe("taskStatus", () => {
  const first = task("first", [userStep("s")]);
  const second = task("second", [userStep("s")], { dependsOn: ["first"] });

  it("bloqueada mientras su dependencia no esté resuelta", () => {
    assert.equal(taskStatus(second, [first, second]), "blocked");
    const doneFirst = task("first", [userStep("s", { status: "done" })]);
    assert.equal(taskStatus(second, [doneFirst, second]), "todo");
  });

  it("una dependencia saltada cuenta como resuelta", () => {
    const skipped = task("first", [userStep("s", { status: "skipped" })]);
    assert.equal(taskStatus(second, [skipped, second]), "todo");
  });

  it("esperando solo si todo lo que queda está pedido a un tercero", () => {
    const waiting = task("w", [userStep("a", { status: "done" }), thirdStep("b", { status: "requested" })]);
    assert.equal(taskStatus(waiting, [waiting]), "waiting");
    const received = task("r", [userStep("a", { status: "done" }), thirdStep("b", { status: "received" })]);
    assert.equal(taskStatus(received, [received]), "doing");
  });

  it("hecha cuando todos sus pasos están hechos o saltados", () => {
    const done = task("d", [userStep("a", { status: "done" }), userStep("b", { status: "skipped" })]);
    assert.equal(taskStatus(done, [done]), "done");
  });
});

describe("bloqueo blando", () => {
  it("se puede avanzar una tarea bloqueada, pero queda marcada", () => {
    const first = task("first", [userStep("s")]);
    const second = task("second", [userStep("s", { status: "done" }), userStep("t")], { dependsOn: ["first"] });
    assert.equal(taskStatus(second, [first, second]), "doing");
    assert.equal(taskOutOfOrder(second, [first, second]), true);
  });

  it("marca el paso hecho antes que su dependencia", () => {
    const t = task("t", [userStep("a"), userStep("b", { dependsOn: ["a"], status: "done" })]);
    assert.equal(stepOutOfOrder(t.steps[1], t), true);
    assert.equal(stepOutOfOrder(t.steps[0], t), false);
  });
});

describe("taskTotals", () => {
  it("suma esfuerzo y coste, sin contar los saltados", () => {
    const t = task("t", [userStep("a"), thirdStep("b"), userStep("c", { status: "skipped" })]);
    const totals = taskTotals(t);
    assert.deepEqual(totals.effort, { min: 1.5, max: 2.5 });
    assert.deepEqual(totals.cost, { min: 50, max: 150 });
  });

  it("las esperas encadenadas se suman y las paralelas no", () => {
    const parallel = task("p", [thirdStep("a"), thirdStep("b")]);
    assert.deepEqual(taskTotals(parallel).wait, { min: 3, max: 7 });
    const chained = task("c", [thirdStep("a"), thirdStep("b", { dependsOn: ["a"] })]);
    assert.deepEqual(taskTotals(chained).wait, { min: 6, max: 14 });
  });
});