"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { parseIdea } from "@/lib/report/idea";
import { classifyIdea } from "@/lib/report/classify";
import { analyse } from "@/lib/report/analyse";
import type { Fact } from "@/lib/report/facts";
import { getOwnReport, insertReport, updateOwnReport, type ReportStatus } from "@/lib/report/repository";
import { currentStep, mergeFacts, nextStatus, parseAnswers } from "@/lib/report/questions";

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
    await updateOwnReport(userId, id, "analysis", { facts: await analyse(idea, facts), status: "review" });
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