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
import { answerPending, applyGeneration, generateTask } from "@/lib/plan/generate";
import { liveDeps } from "@/lib/plan/live";
import { parseReplies } from "@/lib/plan/replies-form";

export type PlanFormState = { error: string | null };
export type GenerateError = "stale" | "unavailable" | "kept" | "not_allowed" | "invalid";
export type GenerateState = { error: GenerateError | null };

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

/** Informe y plan del usuario, o null. */
async function loadOwnPlan(reportId: string) {
  const user = await requireUser();
  const report = typeof reportId === "string" ? await getOwnReport(user.id, reportId) : null;
  const existing = report ? await getOwnPlanByReport(user.id, report.id) : null;
  return report && existing ? { user, report, existing } : null;
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadOwnPlan>>>;

/** Personaliza la tarea con el plan guardado (o con el que se le pase) y guarda solo si sale bien. */
async function personalize(loaded: Loaded, taskId: string, version: number, stored = loaded.existing.stored) {
  const { user, report, existing } = loaded;
  const input = planInput(report);
  const date = today();
  const rebuild = (s: typeof stored) =>
    rebuildPlan({ report: input, config: existing.config, catalog: MOLDS, stored: s, today: date });

  const state = rebuild(stored);
  const outcome = await generateTask(liveDeps, {
    idea: report.idea,
    facts: report.facts,
    language: input.language,
    config: existing.config,
    catalog: MOLDS,
    plan: state,
    taskId,
  });
  if (outcome.status !== "generated" && outcome.status !== "questions") return { error: outcome.status } as const;

  const next = rebuild(applyGeneration(toStored(state), outcome));
  if (!(await updateOwnPlan(user.id, existing.id, version, { stored: toStored(next) }))) return { error: "stale" } as const;
  return { target: outcome.status === "generated" ? outcome.tasks[0].id : taskId } as const;
}

/** "Personalizar con IA" o "Volver a generar" en una tarea. */
export async function generateTaskAction(
  reportId: string,
  taskId: string,
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const loaded = await loadOwnPlan(reportId);
  // Una pestaña antigua no gasta llamadas a la IA.
  if (!loaded || Number(formData.get("version")) !== loaded.existing.version) return { error: "stale" };

  let target: string;
  try {
    const result = await personalize(loaded, taskId, loaded.existing.version);
    if ("error" in result) return { error: result.error };
    target = result.target;
  } catch (err) {
    logError("personalizar la tarea", err);
    return { error: "unavailable" };
  }
  redirect(`/informe/${loaded.report.id}/plan#tarea-${encodeURIComponent(target)}`);
}

/** Responde las preguntas previas de una tarea y la personaliza. Todo o nada. */
export async function answerAndGenerateAction(
  reportId: string,
  taskId: string,
  mold: string,
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const loaded = await loadOwnPlan(reportId);
  if (!loaded || Number(formData.get("version")) !== loaded.existing.version) return { error: "stale" };

  const pending = (loaded.existing.stored.pendingQuestions ?? []).filter((q) => q.mold === mold);
  const replies = parseReplies(pending, (name) => formData.get(name));
  const answered = replies ? answerPending(loaded.existing.stored, mold, replies) : null;
  if (!answered) return { error: "invalid" };

  let target: string;
  try {
    const result = await personalize(loaded, taskId, loaded.existing.version, answered);
    if ("error" in result) return { error: result.error };
    target = result.target;
  } catch (err) {
    logError("responder y personalizar", err);
    return { error: "unavailable" };
  }
  redirect(`/informe/${loaded.report.id}/plan#tarea-${encodeURIComponent(target)}`);
}

function logError(action: string, err: unknown) {
  console.error(`plan: no se pudo ${action}`, err instanceof Error ? err.name : "desconocido");
}