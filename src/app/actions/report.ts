"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { parseIdea } from "@/lib/report/idea";
import { classifyIdea } from "@/lib/report/classify";
import { getOwnReport, insertReport, updateOwnReport } from "@/lib/report/repository";
import { mergeFacts, nextStatus, parseAnswers, pendingQuestions } from "@/lib/report/questions";

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

  // Si Jev falla, el informe queda en "new" y la página ofrece reintentar: la idea no se pierde.
  await classifyReport(user.id, id, parsed.idea);
  redirect(`/informe/${id}`);
}

export async function retryClassification(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report) return { error: "No se ha encontrado el informe." };

  if (report.status === "new" && !(await classifyReport(user.id, report.id, report.idea))) {
    return { error: "Seguimos sin poder analizar tu idea. Inténtalo en unos minutos." };
  }
  redirect(`/informe/${report.id}`);
}

export async function answerQuestions(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const report = typeof id === "string" ? await getOwnReport(user.id, id) : null;
  if (!report || report.status !== "questions") {
    return { error: "Estas preguntas ya no están pendientes. Recarga la página." };
  }

  const parsed = parseAnswers(pendingQuestions(report.facts), (name) => formData.get(name));
  if (!parsed.ok) return { error: parsed.error };

  const facts = mergeFacts(report.facts, parsed.facts);
  try {
    await updateOwnReport(user.id, report.id, "questions", { facts, status: nextStatus(facts) });
  } catch (err) {
    logError("guardar las respuestas", err);
    return { error: "No se han podido guardar tus respuestas. Inténtalo de nuevo." };
  }
  redirect(`/informe/${report.id}`);
}

async function classifyReport(userId: string, id: string, idea: string) {
  try {
    const facts = await classifyIdea(idea);
    await updateOwnReport(userId, id, "new", { facts, status: nextStatus(facts) });
    return true;
  } catch (err) {
    logError("clasificar", err);
    return false;
  }
}

/** Solo el tipo de error: los mensajes de Drizzle incluyen los parámetros (datos del usuario). */
function logError(action: string, err: unknown) {
  console.error(`report: no se pudo ${action}`, err instanceof Error ? err.name : "desconocido");
}