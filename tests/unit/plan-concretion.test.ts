import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyConcretions, canGenerate } from "../../src/lib/plan/concretion.ts";
import type { Step } from "../../src/lib/plan/step.ts";
import type { Task } from "../../src/lib/plan/task.ts";

const step = (extra: Partial<Step> = {}): Step => ({
  id: "s",
  order: 0,
  text: "s",
  doneWhen: "s",
  suggestedActor: "user",
  allowedActors: ["user"],
  actor: "user",
  effort: { min: 1, max: 1 },
  status: "todo",
  ...extra,
});

const task = (id: string, extra: Partial<Task> = {}, s: Partial<Step> = {}): Task => ({
  id,
  lineId: "line",
  phase: "prepare",
  kind: "action",
  title: id,
  outcome: id,
  dependsOn: [],
  basis: [],
  validation: "per_step",
  origin: "catalog",
  mold: id,
  steps: [step(s)],
  ...extra,
});
const ai = (id: string, mold: string, extra: Partial<Task> = {}) => task(id, { origin: "ai", mold, ...extra });
const NONE = new Set<string>();

describe("canGenerate", () => {
  it("solo tareas del molde sin tocar", () => {
    assert.equal(canGenerate(task("a")), true);
    assert.equal(canGenerate(task("a", {}, { status: "done" })), false);
    assert.equal(canGenerate(ai("a1", "a")), false);
    assert.equal(canGenerate(task("decide:x", { mold: undefined })), false);
  });
});

describe("applyConcretions", () => {
  const skeleton = [task("a"), task("b", { dependsOn: ["a"], lineId: "risk:x" }), task("c", { dependsOn: ["b"] })];

  it("las generadas ocupan el sitio del molde y quien lo esperaba las espera a todas", () => {
    const stored = [
      ai("b1", "b", { dependsOn: ["old"], lineId: "other", phase: "operate" }),
      ai("b2", "b", { dependsOn: ["b1"] }),
    ];
    const result = applyConcretions(skeleton, stored, NONE);
    assert.deepEqual(result.map((t) => t.id), ["a", "b1", "b2", "c"]);
    const [, b1, b2, c] = result;
    assert.deepEqual(b1.dependsOn, ["a"]);
    assert.deepEqual([b1.lineId, b1.phase], ["risk:x", "prepare"]);
    assert.deepEqual(b2.dependsOn, ["a", "b1"]);
    assert.deepEqual(c.dependsOn, ["b1", "b2"]);
  });

  it("si se quitan todas, vuelve el molde", () => {
    const result = applyConcretions(skeleton, [ai("b1", "b")], new Set(["b1"]));
    assert.deepEqual(result.map((t) => t.id), ["a", "b", "c"]);
    assert.deepEqual(result[2].dependsOn, ["b"]);
  });

  it("las archivadas o de un molde que ya no está no sustituyen nada", () => {
    const stored = [ai("b1", "b", { archived: "no_longer_needed" }), ai("z1", "z")];
    assert.deepEqual(applyConcretions(skeleton, stored, NONE).map((t) => t.id), ["a", "b", "c"]);
  });
});