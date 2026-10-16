import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { report } from "@/db/schema";

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