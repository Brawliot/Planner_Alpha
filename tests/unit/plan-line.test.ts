import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeDepartments, lineIssues, lineProgress, lineSchema, type Line } from "../../src/lib/plan/line.ts";
import type { Step } from "../../src/lib/plan/step.ts";
import type { Task } from "../../src/lib/plan/task.ts";

const step = (status: Step["status"]): Step => ({
  id: "s",
  order: 0,
  text: "s",
  doneWhen: "s",
  suggestedActor: "user",
  allowedActors: ["user"],
  actor: "user",
  effort: { min: 1, max: 1 },
  status,
});

const task = (id: string, lineId: string, status: Step["status"] = "todo"): Task => ({
  id,
  lineId,
  phase: "prepare",
  kind: "action",
  title: id,
  outcome: id,
  dependsOn: [],
  basis: [],
  validation: "per_step",
  steps: [step(status)],
});

const CROWDED: Line = {
  id: "competition.crowded",
  department: "sales",
  source: { kind: "risk", area: "competition", reason: "competition.crowded" },
  goal: "Diferenciarte en un mercado saturado",
};
const LEGAL: Line = { id: "base.legal_setup", department: "legal", source: { kind: "base" }, goal: "Alta" };

const valid = (value: unknown) => lineSchema.safeParse(value).success;

describe("lineSchema", () => {
  it("acepta líneas de rojo y base", () => {
    assert.ok(valid(CROWDED));
    assert.ok(valid(LEGAL));
  });

  it("rechaza áreas, departamentos u orígenes desconocidos", () => {
    assert.ok(!valid({ ...CROWDED, source: { ...CROWDED.source, area: "weather" } }));
    assert.ok(!valid({ ...CROWDED, department: "it" }));
    assert.ok(!valid({ ...CROWDED, source: { kind: "strong", area: "money" } }));
  });

  it("gris, por concretar y estimado necesitan al menos una clave", () => {
    assert.ok(!valid({ ...CROWDED, source: { kind: "gaps", area: "money", keys: [] } }));
    assert.ok(valid({ ...CROWDED, source: { kind: "gaps", area: "money", keys: ["monthly_fixed_costs_eur"] } }));
  });
});

describe("lineProgress", () => {
  it("cuenta tareas resueltas y da la línea por hecha solo si todas lo están", () => {
    const tasks = [task("a", CROWDED.id, "done"), task("b", CROWDED.id), task("c", LEGAL.id, "done")];
    assert.deepEqual(lineProgress(CROWDED, tasks), { resolved: 1, total: 2, done: false });
    assert.deepEqual(lineProgress(LEGAL, tasks), { resolved: 1, total: 1, done: true });
  });
});

describe("activeDepartments", () => {
  it("solo los que tienen líneas, en orden fijo", () => {
    assert.deepEqual(activeDepartments([LEGAL, CROWDED]), ["sales", "legal"]);
  });
});

describe("lineIssues", () => {
  it("avisa de líneas repetidas, tareas sin línea y líneas vacías", () => {
    const issues = lineIssues([CROWDED, CROWDED, LEGAL], [task("a", CROWDED.id), task("x", "nope")]);
    assert.deepEqual(issues, [
      "duplicate line competition.crowded",
      "task x has unknown line nope",
      "line base.legal_setup has no tasks",
    ]);
  });
});