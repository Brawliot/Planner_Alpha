import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
import { STORED_FORMAT, readConfig, readStored, toStored } from "../../src/lib/plan/stored.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";
import { EXAMPLES } from "../../scripts/plan-examples.ts";

const { facts, config: extra } = EXAMPLES.cafe;
const today = "2026-10-22";
const config = { ...prefillConfig(facts, today).config, ...extra };
const report = { facts, verdicts: areaVerdicts(facts), language: "es" as const, fingerprint: "f" };
const state = rebuildPlan({ report, config, catalog: MOLDS, stored: null, today });
const saved = toStored(state);
// Lo que devuelve la BD: JSON plano.
const fromDb = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("readStored", () => {
  it("un plan válido sale igual y con la versión actual", () => {
    const read = readStored(fromDb(saved));
    assert.equal(read.repaired, false);
    assert.equal(read.stored.formatVersion, STORED_FORMAT);
    assert.equal(read.stored.tasks.length, saved.tasks.length);
  });

  it("un plan antiguo sin número de formato se lee sin avisar", () => {
    const old = fromDb(saved);
    delete old.formatVersion;
    const read = readStored(old);
    assert.equal(read.repaired, false);
    assert.equal(read.stored.formatVersion, STORED_FORMAT);
  });

  it("una tarea rota se descarta, las demás se quedan con su progreso y se avisa", () => {
    const damaged = fromDb(saved);
    damaged.tasks[0].steps[0].status = "done";
    damaged.tasks[1] = { id: "rota" };
    const read = readStored(damaged);
    assert.equal(read.repaired, true);
    assert.equal(read.stored.tasks.length, saved.tasks.length - 1);
    assert.equal(read.stored.tasks[0].steps[0].status, "done");
    assert.ok(read.problems.some((p) => p.startsWith("tasks[1]")));
  });

  it("al recalcular, el motor repone la tarea descartada desde el catálogo", () => {
    const damaged = fromDb(saved);
    const lost = damaged.tasks[1].id;
    damaged.tasks[1] = { id: "rota" };
    const rebuilt = rebuildPlan({ report, config, catalog: MOLDS, stored: readStored(damaged).stored, today });
    assert.ok(rebuilt.tasks.some((t) => t.id === lost));
  });

  it("basura total no rompe: plan vacío y avisado", () => {
    for (const junk of [null, "x", 42, [], { tasks: "no" }]) {
      const read = readStored(junk);
      assert.equal(read.repaired, true);
      assert.deepEqual(read.stored.tasks, []);
    }
  });
});

describe("readConfig", () => {
  it("válida se queda; rota usa los valores por defecto y avisa", () => {
    assert.deepEqual(readConfig(fromDb(config), today), { config, repaired: false });
    const bad = readConfig({ startDate: "ayer" }, today);
    assert.equal(bad.repaired, true);
    assert.equal(bad.config.startDate, "2026-10-26");
  });
});