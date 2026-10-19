import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStepProtected, isTaskProtected, mergeTasks } from "../../src/lib/plan/merge.ts";
import type { Step } from "../../src/lib/plan/step.ts";
import { pendingDependencies, type Task } from "../../src/lib/plan/task.ts";
import { buildTimeline } from "../../src/lib/plan/timeline.ts";

const step = (extra: Partial<Step> = {}): Step => ({
  id: "s",
  order: 0,
  text: "s",
  doneWhen: "s",
  suggestedActor: "user",
  allowedActors: ["user"],
  actor: "user",
  effort: { min: 7, max: 7 },
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
  steps: [step(s)],
  ...extra,
});

const ids = (tasks: Task[]) => tasks.map((t) => `${t.id}${t.archived ? "(archived)" : ""}`);
const NONE = new Set<string>();

describe("protección", () => {
  it("un paso tocado está protegido; uno intacto no", () => {
    assert.equal(isStepProtected(step()), false);
    assert.equal(isStepProtected(step({ status: "done" })), true);
    assert.equal(isStepProtected(step({ actorSetBy: "user" })), true);
    assert.equal(isStepProtected(step({ note: "ojo" })), true);
    assert.equal(isStepProtected(step({ actorSetBy: "config" })), false);
  });

  it("una tarea con algún paso protegido está protegida", () => {
    assert.equal(isTaskProtected(task("t", {}, { status: "skipped" })), true);
    assert.equal(isTaskProtected(task("t")), false);
  });
});

describe("mergeTasks", () => {
  it("lo nuevo entra y lo no protegido se rehace", () => {
    const current = [task("a", { title: "viejo" })];
    const merged = mergeTasks(current, [task("a", { title: "nuevo" }), task("b")], NONE);
    assert.deepEqual(ids(merged), ["a", "b"]);
    assert.equal(merged[0].title, "nuevo");
  });

  it("lo protegido se queda tal cual", () => {
    const current = [task("a", { title: "mío" }, { status: "done" })];
    const merged = mergeTasks(current, [task("a", { title: "nuevo" })], NONE);
    assert.equal(merged[0].title, "mío");
  });

  it("lo que ya no aplica: se quita si está intacto, se archiva si se empezó", () => {
    const current = [task("intact"), task("started", {}, { status: "done" })];
    assert.deepEqual(ids(mergeTasks(current, [], NONE)), ["started(archived)"]);
  });

  it("una archivada que vuelve a aplicar se desarchiva con su progreso", () => {
    const current = [task("a", { archived: "no_longer_needed" }, { status: "done" })];
    const merged = mergeTasks(current, [task("a")], NONE);
    assert.deepEqual(ids(merged), ["a"]);
    assert.equal(merged[0].steps[0].status, "done");
  });

  it("las sugeridas por IA siguen la regla de todas: fuera del plan, se quitan o se archivan", () => {
    const current = [task("ai1", { origin: "ai" }), task("ai2", { origin: "ai" }, { status: "done" })];
    assert.deepEqual(ids(mergeTasks(current, [task("x")], NONE)), ["x", "ai2(archived)"]);
  });

  it("lo protegido conserva lo suyo, pero su sitio en el plan lo decide el código", () => {
    const current = [task("a", { title: "mío", lineId: "old", dependsOn: ["gone"] }, { status: "done" })];
    const [merged] = mergeTasks(current, [task("a", { title: "nuevo", lineId: "line", dependsOn: ["b"] })], NONE);
    assert.equal(merged.title, "mío");
    assert.equal(merged.steps[0].status, "done");
    assert.equal(merged.lineId, "line");
    assert.deepEqual(merged.dependsOn, ["b"]);
  });

  it("lo descartado no vuelve", () => {
    assert.deepEqual(ids(mergeTasks([], [task("a"), task("b")], new Set(["a"]))), ["b"]);
  });
});

describe("archivadas", () => {
  const archived = task("old", { archived: "no_longer_needed" }, { status: "requested", actor: "user" });
  const next = task("next", { dependsOn: ["old"] });

  it("no bloquean a quien depende de ellas", () => {
    assert.deepEqual(pendingDependencies(next, [archived, next]), []);
  });

  it("no entran en el timeline", () => {
    const t = buildTimeline({
      tasks: [archived, next],
      startDate: "2026-11-02",
      today: "2026-11-02",
      weeklyHours: { min: 7, max: 7 },
    });
    assert.deepEqual(
      t.tasks.map((s) => s.taskId),
      ["next"],
    );
    assert.deepEqual(t.tasks[0].start, { min: 0, max: 0 });
  });
});