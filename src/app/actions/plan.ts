"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnReport } from "@/lib/report/repository";
import { MOLDS } from "@/lib/plan/catalog";
import { parseConfigForm } from "@/lib/plan/config-form";
import { planInput } from "@/lib/plan/input";
import { rebuildPlan } from "@/lib/plan/orchestrator";
import { prefillConfig } from "@/lib/plan/prefill";
import { getOwnPlanByReport, insertPlan, updateOwnPlan } from "@/lib/plan/repository";
import { toStored } from "@/lib/plan/stored";

export type PlanFormState = { error: string | null };

// Las Server Actions se pueden llamar con un POST directo: sesión y dueño se comprueban siempre aquí.

const today = () => new Date().toISOString().slice(0, 10);

/** Crea el plan con lo que sabe el informe (aprobado) y lleva a él. Si ya existe, lleva a él. */
export async function createPlan(reportId: string): Promise<PlanFormState> {
  const user = await requireUser();
  const report = typeof reportId === "string" ? await getOwnReport(user.id, reportId) : null;
  if (!report || report.status !== "approved") return { error: "Aprueba el informe antes de crear el plan." };

  try {
    const existing = await getOwnPlanByReport(user.id, report.id);
    if (!existing) {
      const date = today();
      const { config } = prefillConfig(report.facts, date);
      const state = rebuildPlan({ report: planInput(report), config, catalog: MOLDS, stored: null, today: date });
      // null = otra petición lo creó a la vez: también vale, se lleva al existente.
      await insertPlan(user.id, report.id, { config, stored: toStored(state), onboardingStep: null });
    }
  } catch (err) {
    logError("crear el plan", err);
    return { error: "No se ha podido crear el plan. Inténtalo de nuevo." };
  }
  redirect(`/informe/${report.id}/plan`);
}

/** Guarda el formulario corto de configuración y recalcula el plan sin pisar lo protegido. */
export async function saveConfig(reportId: string, _prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const user = await requireUser();
  const report = typeof reportId === "string" ? await getOwnReport(user.id, reportId) : null;
  const existing = report ? await getOwnPlanByReport(user.id, report.id) : null;
  if (!report || !existing) return { error: "No se ha encontrado el plan." };

  const version = Number(formData.get("version"));
  if (!Number.isInteger(version)) return { error: "Recarga la página e inténtalo de nuevo." };

  const parsed = parseConfigForm(
    existing.config,
    (name) => formData.get(name),
    (name) => formData.getAll(name),
  );
  if (!parsed.ok) return { error: parsed.error };

  try {
    const date = today();
    const state = rebuildPlan({
      report: planInput(report),
      config: parsed.config,
      catalog: MOLDS,
      stored: existing.stored,
      today: date,
    });
    const saved = await updateOwnPlan(user.id, existing.id, version, { config: parsed.config, stored: toStored(state) });
    if (!saved) return { error: "Este plan ha cambiado en otra pestaña. Recarga la página." };
  } catch (err) {
    logError("guardar la configuración", err);
    return { error: "No se han podido guardar los cambios. Inténtalo de nuevo." };
  }
  redirect(`/informe/${report.id}/plan`);
}

function logError(action: string, err: unknown) {
  console.error(`plan: no se pudo ${action}`, err instanceof Error ? err.name : "desconocido");
}