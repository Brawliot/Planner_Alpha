import { z } from "zod";

/**
 * Paso de una tarea del plan: una acción concreta con un ejecutor y un estado.
 * Las cifras (esfuerzo, espera, coste) vienen del catálogo y siempre son estimadas;
 * ningún modelo las inventa. Lo que genera la IA nunca se da por hecho sin validarlo el usuario.
 */

export const ACTORS = ["user", "ai", "third_party"] as const;
export type Actor = (typeof ACTORS)[number];

export const THIRD_PARTIES = [
  "advisor",
  "lawyer",
  "designer",
  "developer",
  "public_body",
  "supplier",
  "bank",
  "other",
] as const;
export type ThirdParty = (typeof THIRD_PARTIES)[number];
/** Terceros que el usuario puede "tener" (pregunta "¿con quién cuentas?"). */
export const PROFESSIONALS = ["advisor", "lawyer", "designer", "developer"] as const satisfies readonly ThirdParty[];

/** Habilidades que puede pedir un paso (pregunta "¿qué sabes hacer?"). */
export const SKILLS = ["design", "social_media", "accounting", "programming", "sales", "trade"] as const;
export type Skill = (typeof SKILLS)[number];

/** Quién fijó el actor: la configuración (recalculable) o el usuario a mano (nunca se pisa). Ausente = config. */
export const ACTOR_SETTERS = ["config", "user"] as const;
export const AI_CAPABILITIES = ["draft_text", "checklist", "comparison_table", "research_summary"] as const;

export const STEP_STATUSES = ["todo", "ai_draft", "requested", "received", "done", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** Estados posibles según quién hace el paso. */
export const STATUSES_BY_ACTOR: Record<Actor, readonly StepStatus[]> = {
  user: ["todo", "done", "skipped"],
  ai: ["todo", "ai_draft", "done", "skipped"],
  third_party: ["todo", "requested", "received", "done", "skipped"],
};

/**
 * Avances permitidos. Volver a "todo" (reabrir) se permite desde cualquier estado.
 * ai_draft → done solo debe exponerse desde la acción "validar" del usuario.
 */
const FORWARD: Record<Actor, Partial<Record<StepStatus, readonly StepStatus[]>>> = {
  user: { todo: ["done", "skipped"] },
  ai: { todo: ["ai_draft", "skipped"], ai_draft: ["done", "skipped"] },
  third_party: { todo: ["requested", "skipped"], requested: ["received", "skipped"], received: ["done"] },
};

export function canTransition(actor: Actor, from: StepStatus, to: StepStatus) {
  if (!STATUSES_BY_ACTOR[actor].includes(from) || !STATUSES_BY_ACTOR[actor].includes(to)) return false;
  if (to === "todo") return from !== "todo";
  return FORWARD[actor][from]?.includes(to) ?? false;
}

const range = z
  .object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
  .refine((r) => r.min <= r.max, "min > max");

export const stepSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    /** Pasos de la misma tarea que deben estar resueltos antes (bloqueo blando). */
    dependsOn: z.array(z.string().min(1)).optional(),
    text: z.string().min(1),
    doneWhen: z.string().min(1),
    suggestedActor: z.enum(ACTORS),
    allowedActors: z.array(z.enum(ACTORS)).min(1),
    actor: z.enum(ACTORS),
    /** Horas tuyas: hacerlo (user), revisarlo (ai) o pedirlo (third_party). */
    effort: range,
    thirdParty: z.enum(THIRD_PARTIES).optional(),
    /** Días de espera al tercero. */
    wait: range.optional(),
    aiCapability: z.enum(AI_CAPABILITIES).optional(),
    skill: z.enum(SKILLS).optional(),
    actorSetBy: z.enum(ACTOR_SETTERS).optional(),
    /** Euros. */
    cost: range.optional(),
    status: z.enum(STEP_STATUSES),
    artifact: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((step, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (!step.allowedActors.includes(step.actor)) issue("actor not allowed");
    if (!step.allowedActors.includes(step.suggestedActor)) issue("suggestedActor not allowed");

    const isThird = step.actor === "third_party";
    if (isThird !== (step.thirdParty !== undefined)) issue("thirdParty only and always with third_party");
    if (isThird !== (step.wait !== undefined)) issue("wait only and always with third_party");
    if ((step.actor === "ai") !== (step.aiCapability !== undefined)) issue("aiCapability only and always with ai");

    if (!STATUSES_BY_ACTOR[step.actor].includes(step.status)) issue("status not valid for actor");
    // Un borrador de IA sin contenido no se puede validar.
    if (step.status === "ai_draft" && !step.artifact) issue("ai_draft needs an artifact");
  });

export type Step = z.infer<typeof stepSchema>;