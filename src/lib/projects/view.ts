/**
 * Lo que muestra cada tarjeta de "Mis proyectos". Solo datos ya decididos: nunca los datos
 * internos del informe ni del plan.
 */

export type ProjectStage =
  /** No se pudo analizar la idea: hay que reintentar. */
  | "retry"
  /** Quedan preguntas por responder. */
  | "questions"
  /** Analizando (unos segundos). */
  | "analysis"
  /** Informe listo para revisar y aprobar. */
  | "review"
  /** Informe aprobado, sin plan todavía. */
  | "approved"
  /** Plan creado. */
  | "plan";

export interface ProjectCardView {
  reportId: string;
  /** La idea recortada a una línea legible. */
  title: string;
  /** Fecha ISO de la última actualización. */
  updatedAt: string;
  stage: ProjectStage;
  /** Solo con plan. */
  plan: {
    done: number;
    total: number;
    /** Semanas hasta abrir (estimado); null si ya no está pendiente. */
    opening: { from: number; to: number } | null;
    /** Primera tarea de "Ahora", si la hay. */
    now: string | null;
  } | null;
}