import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { report, type REPORT_STATUSES } from "@/db/schema";
import type { Fact } from "./facts";
import type { StoredNarrative } from "./narrative";
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export async function insertReport(userId: string, idea: string) {
  const [row] = await db.insert(report).values({ userId, idea }).returning({ id: report.id });
  return row.id;
}

/** Devuelve el informe solo si es del usuario: la autorización va en la propia consulta. */
export async function getOwnReport(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(report)
    .where(and(eq(report.id, id), eq(report.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Actualiza solo si el informe es del usuario y sigue en el estado esperado:
 * un doble envío o una pestaña antigua no pueden pisar un informe que ya avanzó.
 */
export async function updateOwnReport(
  userId: string,
  id: string,
  expectedStatus: ReportStatus,
  values: { facts: Fact[]; status: ReportStatus; narrative?: StoredNarrative },
) {
  await db
    .update(report)
    .set(values)
    .where(and(eq(report.id, id), eq(report.userId, userId), eq(report.status, expectedStatus)));
}