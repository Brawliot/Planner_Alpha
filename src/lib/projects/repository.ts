import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plan, report } from "@/db/schema";

/** Informes del usuario con su plan (si lo tiene), del más reciente al más antiguo. */
export async function listOwnProjects(userId: string) {
  return db
    .select({ report, plan })
    .from(report)
    .leftJoin(plan, and(eq(plan.reportId, report.id), eq(plan.userId, userId)))
    .where(eq(report.userId, userId))
    .orderBy(desc(report.updatedAt));
}

/** ¿Tiene alguna idea? Para llevarle a "Mis proyectos" al entrar. */
export async function hasOwnProjects(userId: string) {
  const [row] = await db.select({ id: report.id }).from(report).where(eq(report.userId, userId)).limit(1);
  return row !== undefined;
}