import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { plan } from "@/db/schema";
import type { PlanConfig } from "./config";
import type { StoredPlan } from "./orchestrator";
import { readConfig, readStored } from "./stored";

/**
 * Persistencia del plan. La autorización va en la propia consulta (userId), como en el informe.
 * Solo se guarda lo que no se puede recalcular: el informe se lee en directo y el timeline,
 * las decisiones y los avisos los recalcula rebuildPlan.
 */

/** Crea el plan del informe. null si ya existía (doble clic): la acción lee el existente. */
export async function insertPlan(
  userId: string,
  reportId: string,
  values: { config: PlanConfig; stored: StoredPlan; onboardingStep: string | null },
) {
  const [row] = await db
    .insert(plan)
    .values({ userId, reportId, ...values })
    .onConflictDoNothing({ target: plan.reportId })
    .returning({ id: plan.id });
  return row?.id ?? null;
}

/**
 * El plan del informe, solo si es del usuario. El JSON guardado se migra y se revisa al leerlo:
 * lo dañado se descarta (repaired) en vez de romper la página.
 */
export async function getOwnPlanByReport(userId: string, reportId: string) {
  const [row] = await db
    .select()
    .from(plan)
    .where(and(eq(plan.reportId, reportId), eq(plan.userId, userId)))
    .limit(1);
  if (!row) return null;

  const read = readStored(row.stored);
  const config = readConfig(row.config, new Date().toISOString().slice(0, 10));
  if (read.repaired || config.repaired) {
    console.error(`plan: datos guardados reparados al leer (${row.id})`, [...read.problems, ...(config.repaired ? ["config"] : [])]);
  }
  return { ...row, stored: read.stored, config: config.config, repaired: read.repaired || config.repaired };
}

/**
 * Guarda cambios solo si el plan es del usuario y nadie lo ha cambiado desde que se leyó
 * (misma versión). false = no se ha guardado: hay que recargar.
 */
export async function updateOwnPlan(
  userId: string,
  id: string,
  expectedVersion: number,
  values: Partial<{ config: PlanConfig; stored: StoredPlan; onboardingStep: string | null }>,
) {
  const rows = await db
    .update(plan)
    .set({ ...values, version: expectedVersion + 1 })
    .where(and(eq(plan.id, id), eq(plan.userId, userId), eq(plan.version, expectedVersion)))
    .returning({ id: plan.id });
  return rows.length > 0;
}