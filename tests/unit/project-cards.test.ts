import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
import { toStored } from "../../src/lib/plan/stored.ts";
import { projectCard, projectTitle, type ProjectRow } from "../../src/lib/projects/cards.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";
import { EXAMPLES } from "../../scripts/plan-examples.ts";

const today = "2026-10-22";
const { facts, idea, config: extra } = EXAMPLES.cafe;
const report = (status: string, updated = "2026-10-20"): ProjectRow["report"] => ({
  id: "r1",
  idea,
  status,
  facts,
  narrative: null,
  updatedAt: new Date(`${updated}T10:00:00Z`),
});

describe("projectCard", () => {
  it("sin plan: el estado del informe y su acción", () => {
    assert.equal(projectCard({ report: report("questions"), plan: null }, today).stage, "questions");
    assert.equal(projectCard({ report: report("approved"), plan: null }, today).stage, "approved");
    assert.equal(projectCard({ report: report("new"), plan: null }, today).stage, "retry");
  });

  it("con plan: progreso, apertura, Ahora y la fecha más reciente", () => {
    const config = { ...prefillConfig(facts, today).config, ...extra };
    const state = rebuildPlan({
      report: { facts, verdicts: areaVerdicts(facts), language: "en", fingerprint: "f" },
      config,
      catalog: MOLDS,
      stored: null,
      today,
    });
    const card = projectCard(
      { report: report("approved"), plan: { config, stored: toStored(state), updatedAt: new Date("2026-10-21T08:00:00Z") } },
      today,
    );
    assert.equal(card.stage, "plan");
    assert.equal(card.updatedAt, "2026-10-21");
    assert.ok(card.plan && card.plan.total > 0 && card.plan.done === 0);
    assert.ok(card.plan?.now);
  });

  it("un plan dañado no rompe la tarjeta", () => {
    const card = projectCard({ report: report("approved"), plan: { config: null, stored: "basura", updatedAt: new Date() } }, today);
    assert.equal(card.stage, "plan");
  });
});

describe("projectTitle", () => {
  it("primera línea, sin espacios de más, recortada", () => {
    assert.equal(projectTitle("  Una  cafetería\nen mi barrio "), "Una cafetería");
    assert.equal(projectTitle("x".repeat(100)).length, 80);
  });
});