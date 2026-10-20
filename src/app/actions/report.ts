"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/session";
import { parseIdea } from "@/lib/report/idea";
import { classifyIdea } from "@/lib/report/classify";
import { parseEdits } from "@/lib/report/edit";
import { findContradictions } from "@/lib/report/contradictions";
import type { Fact } from "@/lib/report/facts";
import { getOwnReport, insertReport, updateOwnReport, type ReportStatus } from "@/lib/report/repository";
import { currentStep, mergeFacts, nextStatus, parseAnswers } from "@/lib/report/questions";
import { analyse, reanalyse, writeNarrative, writeSummary } from "@/lib/report/analyse";
import { improvementsByArea, parseImproveAnswers } from "@/lib/report/improve";
export type FormState = { error: string | null };

// Las Server Actions se pueden llamar con un POST directo: sesión y dueño se comprueban siempre aquí.

export async function createReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = parseIdea(formData.get("idea"));
  if (!parsed.ok) return { error: parsed.error };

  let id: string;
  try {
    id = await insertReport(user.id, parsed.idea);
  } catch (err) {
    logError("guardar", err);
    return { error: "No se ha podido guardar tu idea. Inténtalo de nuevo." };
  }

  // Si algo falla, el informe queda en su estado y la página ofrece reintentar: la idea no se pierde.
  await classifyReport(user.id, id, parsed.idea);
  redirect(`/informe/${id}`);
}

export async function retryClassification(id: string): Promise<FormState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report) return { error: "No se ha encontrado el informe." };

  if (report.status === "new" && !(await classifyReport(user.id, report.id, report.idea))) {
    return { error: "Seguimos sin poder analizar tu idea. Inténtalo en unos minutos." };
  }
  redirect(`/informe/${report.id}`);
}

export async function retryAnalysis(id: string): Promise<FormState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report) return { error: "No se ha encontrado el informe." };

  if (report.status === "analysis" && !(await analyseReport(user.id, report.id, report.idea, report.facts))) {
    return { error: "Seguimos sin poder completar el análisis. Inténtalo en unos minutos." };
  }
  redirect(`/informe/${report.id}`);
}

export async function answerQuestions(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  // El servidor decide qué tema toca: una pestaña antigua o un formulario manipulado no cuela otro.
  const step = report?.status === "questions" ? currentStep(report.facts) : null;
  if (!report || !step || formData.get("topic") !== step.topic) {
    return { error: "Estas preguntas ya no están pendientes. Recarga la página." };
  }

  const parsed = parseAnswers(step.keys, (name) => formData.get(name));
  if (!parsed.ok) return { error: parsed.error };

  try {
    await saveFacts(user.id, report.id, report.idea, "questions", mergeFacts(report.facts, parsed.facts));
  } catch (err) {
    logError("guardar las respuestas", err);
    return { error: "No se han podido guardar tus respuestas. Inténtalo de nuevo." };
  }
  redirect(`/informe/${report.id}`);
}

/** Errores como código: el panel los muestra en el idioma del informe. */
export type ImproveState = { error: "stale" | "invalid" | "failed" | null };

export async function improveArea(
  id: string,
  area: string,
  _prev: ImproveState,
  formData: FormData,
): Promise<ImproveState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report || report.status !== "review") return { error: "stale" };

  // El servidor recalcula qué preguntas tiene el área ahora: una pestaña antigua no cuela respuestas.
  const questions = improvementsByArea(report.facts).find((a) => a.area === area)?.questions ?? [];
  if (questions.length === 0) return { error: "stale" };

  const parsed = parseImproveAnswers(questions, (name) => formData.get(name));
  if (!parsed.ok) return { error: "invalid" };

  try {
    // Los veredictos se recalculan solos al leer el informe.
    const facts = mergeFacts(report.facts, parsed.facts);
  // Solo se redactan de nuevo las áreas cuyos datos han cambiado.
    const narrative = await writeNarrative(report.idea, facts, report.narrative ?? null);
    await updateOwnReport(user.id, report.id, "review", { facts, status: "review", narrative });
  } catch (err) {
    logError("mejorar el área", err);
    return { error: "failed" };
  }
  redirect(`/informe/${report.id}?area=${encodeURIComponent(area)}`);
}

/** Errores como código: el popup los muestra en el idioma del informe. */
export type SummaryState = { error: "stale" | "failed" | null };

/** Vuelve a redactar solo el resumen ejecutivo. Vale en revisión y aprobado: no toca los datos. */
export async function retrySummary(id: string, _prev: SummaryState): Promise<SummaryState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report?.narrative || (report.status !== "review" && report.status !== "approved")) return { error: "stale" };

  const summary = await writeSummary(report.idea, report.facts);
  if (!summary) return { error: "failed" };
  try {
    await updateOwnReport(user.id, report.id, report.status, {
      facts: report.facts,
      status: report.status,
      narrative: { ...report.narrative, summary },
    });
  } catch (err) {
    logError("guardar el resumen", err);
    return { error: "failed" };
  }
  // Misma página, sin redirección: hay que pedir que se repinte con el resumen nuevo.
  refresh();
  return { error: null };
}

export type EditState = { error: "stale" | "invalid" | "inconsistent_budget" | "failed" | null };

export async function saveEdits(id: string, _prev: EditState, formData: FormData): Promise<EditState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report || report.status !== "review") return { error: "stale" };

  // El servidor compara con lo guardado: solo cuenta lo que ha cambiado de verdad.
  const parsed = parseEdits(report.facts, (name) => formData.get(name));
  if (!parsed.ok) return { error: parsed.error };
  if (parsed.changes.length === 0) redirect(`/informe/${report.id}`);

  try {
    const edited = mergeFacts(report.facts, parsed.changes);
    // Un cambio estructural repite el análisis; el resto se recalcula solo al leer.
    const facts = parsed.structural ? await reanalyse(report.idea, edited) : edited;
    const narrative = await writeNarrative(report.idea, facts, report.narrative ?? null);
    await updateOwnReport(user.id, report.id, "review", { facts, status: "review", narrative });
  } catch (err) {
    logError("guardar los cambios", err);
    return { error: "failed" };
  }
  redirect(`/informe/${report.id}`);
}

export type ApproveState = { error: "stale" | "contradictions" | "failed" | null };

export async function approveReport(id: string): Promise<ApproveState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report || report.status !== "review") return { error: "stale" };
  // Se vuelve a comprobar aquí: el botón oculto no protege.
  if (findContradictions(report.facts).length > 0) return { error: "contradictions" };

  try {
    await updateOwnReport(user.id, report.id, "review", { facts: report.facts, status: "approved" });
  } catch (err) {
    logError("aprobar", err);
    return { error: "failed" };
  }
  redirect(`/informe/${report.id}`);
}

/** Devuelve un informe aprobado a revisión. Cuando exista el plan, no se podrá reabrir. */
export async function reopenReport(id: string): Promise<ApproveState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report || report.status !== "approved") return { error: "stale" };

  try {
    await updateOwnReport(user.id, report.id, "approved", { facts: report.facts, status: "review" });
  } catch (err) {
    logError("reabrir", err);
    return { error: "failed" };
  }
  redirect(`/informe/${report.id}`);
}



async function classifyReport(userId: string, id: string, idea: string) {
  try {
    await saveFacts(userId, id, idea, "new", await classifyIdea(idea));
    return true;
  } catch (err) {
    logError("clasificar", err);
    return false;
  }
}

/** Guarda los datos y, si ya no quedan preguntas, completa el análisis. */
async function saveFacts(userId: string, id: string, idea: string, expected: ReportStatus, facts: Fact[]) {
  const status = nextStatus(facts);
  await updateOwnReport(userId, id, expected, { facts, status });
  // Si el análisis falla, el informe queda en "analysis" y la página ofrece reintentar.
  if (status === "analysis") await analyseReport(userId, id, idea, facts);
}

async function analyseReport(userId: string, id: string, idea: string, facts: Fact[]) {
  try {
    const analysed = await analyse(idea, facts);
    // writeNarrative no falla: si GPT no responde, guarda plantillas.
    const narrative = await writeNarrative(idea, analysed);
    await updateOwnReport(userId, id, "analysis", { facts: analysed, status: "review", narrative });
    return true;
  } catch (err) {
    logError("completar el análisis", err);
    return false;
  }
}

/** Solo el tipo de error: los mensajes de Drizzle incluyen los parámetros (datos del usuario). */
function logError(action: string, err: unknown) {
  console.error(`report: no se pudo ${action}`, err instanceof Error ? err.name : "desconocido");
}