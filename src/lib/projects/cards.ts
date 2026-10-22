import type { Fact } from "../report/facts.ts";
import type { StoredNarrative } from "../report/narrative.ts";
import { MOLDS } from "../plan/catalog.ts";
import { planInput } from "../plan/input.ts";
import { rebuildPlan } from "../plan/orchestrator.ts";
import { readConfig, readStored } from "../plan/stored.ts";
import { isTaskResolved } from "../plan/task.ts";
import { planView } from "../plan/view.ts";
import type { ProjectCardView, ProjectStage } from "./view.ts";

/** Lo que llega de la BD para un proyecto (informe y, si existe, su plan). */
export interface ProjectRow {
  report: { id: string; idea: string; status: string; facts: Fact[]; narrative: StoredNarrative | null; updatedAt: Date };
  plan: { config: unknown; stored: unknown; updatedAt: Date } | null;
}

const MAX_TITLE = 80;

const STAGE_OF: Record<string, ProjectStage> = {
  new: "retry",
  questions: "questions",
  analysis: "analysis",
  review: "review",
  approved: "approved",
};

/** La idea en una línea legible. */
export function projectTitle(idea: string) {
  const line = idea.trim().split(/\r?\n/)[0].replace(/\s+/g, " ");
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 1).trimEnd()}…` : line;
}

export function projectCard(row: ProjectRow, today: string): ProjectCardView {
  const updated = row.plan && row.plan.updatedAt > row.report.updatedAt ? row.plan.updatedAt : row.report.updatedAt;
  const base = {
    reportId: row.report.id,
    title: projectTitle(row.report.idea),
    updatedAt: updated.toISOString().slice(0, 10),
  };
  if (!row.plan) return { ...base, stage: STAGE_OF[row.report.status] ?? "review", plan: null };

  try {
    const input = planInput(row.report);
    const { config } = readConfig(row.plan.config, today);
    const { stored } = readStored(row.plan.stored);
    const state = rebuildPlan({ report: input, config, catalog: MOLDS, stored, today });
    const view = planView({ state, config, catalog: MOLDS, facts: row.report.facts, language: input.language });
    const tasks = state.tasks.filter((t) => t.archived === undefined);
    return {
      ...base,
      stage: "plan",
      plan: {
        done: tasks.filter(isTaskResolved).length,
        total: tasks.length,
        opening: view.opening?.weeks ?? null,
        now: view.now[0]?.title ?? null,
      },
    };
  } catch (error) {
    // La lista no se rompe por un plan: la tarjeta sale sin progreso.
    console.error("projects: no se pudo calcular el plan", error instanceof Error ? error.name : "desconocido");
    return { ...base, stage: "plan", plan: null };
  }
}