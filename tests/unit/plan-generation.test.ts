import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COST_BANDS, EFFORT_BANDS, WAIT_BANDS, effortOf } from "../../src/lib/plan/bands.ts";
import { taskCertainty } from "../../src/lib/plan/certainty.ts";
import { maxSuggestions } from "../../src/lib/plan/complexity.ts";
import { taskSchema, type Task } from "../../src/lib/plan/task.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";

const known = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});
const estimated = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: CALIBRATED_JEV_MODEL } },
});

const task = (basis: string[]): Task => ({
  id: "t",
  lineId: "l",
  phase: "validate",
  kind: "action",
  title: "t",
  outcome: "t",
  dependsOn: [],
  basis,
  validation: "per_step",
  origin: "ai",
  steps: [
    {
      id: "s",
      order: 0,
      text: "s",
      doneWhen: "s",
      suggestedActor: "user",
      allowedActors: ["user"],
      actor: "user",
      effort: effortOf("1_4h"),
      status: "todo",
    },
  ],
});

describe("tramos", () => {
  it("todos son rangos cerrados, crecientes y sin huecos raros", () => {
    for (const table of [EFFORT_BANDS, COST_BANDS, WAIT_BANDS]) {
      const ranges = Object.values(table);
      for (const r of ranges) assert.ok(r.min >= 0 && r.min <= r.max);
      for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i].min >= ranges[i - 1].min);
    }
  });

  it("devuelve copias: modificar el rango no toca la tabla", () => {
    const r = effortOf("1_4h");
    r.max = 999;
    assert.equal(EFFORT_BANDS["1_4h"].max, 4);
  });
});

describe("maxSuggestions", () => {
  it("según complejidad, y baja si Jev no está seguro", () => {
    assert.equal(maxSuggestions("high"), 4);
    assert.equal(maxSuggestions("medium"), 2);
    assert.equal(maxSuggestions(null), maxSuggestions("low"));
  });
});

describe("origin", () => {
  it("solo catalog o ai", () => {
    assert.ok(taskSchema.safeParse(task([])).success);
    assert.ok(!taskSchema.safeParse({ ...task([]), origin: "user" }).success);
  });
});

describe("taskCertainty", () => {
  it("sabida si todo su apoyo es sabido o no tiene apoyo", () => {
    assert.equal(taskCertainty(task(["sector"]), [known("sector", "Retail")]), "known");
    assert.equal(taskCertainty(task([]), []), "known");
  });

  it("estimada si algún apoyo es estimado", () => {
    const facts = [known("sector", "Retail"), estimated("competition", "Few competitors")];
    assert.equal(taskCertainty(task(["sector", "competition"]), facts), "estimated");
  });

  it("no sabida si algún apoyo falta", () => {
    assert.equal(taskCertainty(task(["competition"]), []), "unknown");
  });
});