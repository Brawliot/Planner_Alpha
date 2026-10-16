"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { parseIdea } from "@/lib/report/idea";
import { insertReport } from "@/lib/report/repository";

export type CreateReportState = { error: string | null };

export async function createReport(
  _prev: CreateReportState,
  formData: FormData,
): Promise<CreateReportState> {
  // Las Server Actions se pueden llamar con un POST directo: la sesión se comprueba aquí siempre.
  const user = await requireUser();

  const parsed = parseIdea(formData.get("idea"));
  if (!parsed.ok) return { error: parsed.error };

  let id: string;
  try {
    id = await insertReport(user.id, parsed.idea);
  } catch (err) {
    // Solo el tipo de error: el mensaje de Drizzle incluye los parámetros (la idea del usuario).
    console.error("report: no se pudo guardar", err instanceof Error ? err.name : "desconocido");
    return { error: "No se ha podido guardar tu idea. Inténtalo de nuevo." };
  }

  // Fuera del try: redirect lanza una excepción que Next tiene que recibir.
  redirect(`/informe/${id}`);
}