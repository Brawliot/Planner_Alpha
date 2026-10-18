import { z } from "zod";
import { ACTORS, PROFESSIONALS, SKILLS, type Actor, type Skill, type ThirdParty } from "./step.ts";
import { LEVELS, MILESTONES, type Level, type Task } from "./task.ts";

/**
 * Configuración del entorno ya resuelta: lo que usa el código. Las respuestas de texto libre se
 * interpretan antes (Jev, con su certeza) y solo llegan aquí confirmadas. No cambia el informe.
 */

export const DELEGATION = ["self", "ai", "third_party"] as const;

const isoDate = z.iso.date();
const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const planConfigSchema = z
  .object({
    startDate: isoDate,
    /** Horas por semana entre todos los que trabajan en el proyecto. */
    weeklyHours: z.object({ min: z.number().positive(), max: z.number().positive() }),
    withPartners: z.boolean(),
    unavailable: z.array(z.object({ from: isoDate, to: isoDate })),
    deadline: isoDate.optional(),
    done: z.array(z.enum(MILESTONES)),
    skills: z.array(z.enum(SKILLS)),
    /** null = no lo sé. */
    employed: z.boolean().nullable(),
    hasNetwork: z.boolean().nullable(),
    professionals: z.array(z.enum(PROFESSIONALS)),
    delegation: z.array(z.enum(DELEGATION)).min(1),
    validationLevel: level,
    launchLevel: level,
    /** Palanca elegida por línea; si falta, aún no está decidida. */
    levers: z.record(z.string(), z.string().min(1)),
  })
  .superRefine((config, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (config.weeklyHours.min > config.weeklyHours.max) issue("weeklyHours min > max");
    for (const period of config.unavailable) if (period.from > period.to) issue("unavailable from > to");
  });

export type PlanConfig = z.infer<typeof planConfigSchema>;

/** Valores por defecto: todo "no lo sé" y enfoque intermedio. El plan funciona sin tocar nada. */
export function defaultConfig(startDate: string, weeklyHours: { min: number; max: number }): PlanConfig {
  return {
    startDate,
    weeklyHours,
    withPartners: false,
    unavailable: [],
    done: [],
    skills: [],
    employed: null,
    hasNetwork: null,
    professionals: [],
    delegation: ["self"],
    validationLevel: 2,
    launchLevel: 2,
    levers: {},
  };
}

/** Lo que la regla necesita de un paso del catálogo (incluido a quién iría si se delega). */
export interface ActorChoiceInput {
  allowedActors: readonly Actor[];
  suggestedActor: Actor;
  skill?: Skill;
  professional?: ThirdParty;
  actorSetBy?: "config" | "user";
  actor?: Actor;
}

export type ActorReason =
  | "user_choice"
  | "only_option"
  | "skill"
  | "professional"
  | "ai_preference"
  | "third_party_preference"
  | "self_preference"
  | "suggested";

/**
 * Quién hace el paso y por qué. Orden: tu elección a mano > única opción > lo que sabes hacer >
 * tus profesionales > IA > terceros > tú > lo sugerido por el catálogo.
 */
export function resolveActor(step: ActorChoiceInput, config: PlanConfig): { actor: Actor; reason: ActorReason } {
  const allows = (actor: Actor) => step.allowedActors.includes(actor);
  const wants = (option: (typeof DELEGATION)[number]) => config.delegation.includes(option);

  if (step.actorSetBy === "user" && step.actor && allows(step.actor)) return { actor: step.actor, reason: "user_choice" };
  if (step.allowedActors.length === 1) return { actor: step.allowedActors[0], reason: "only_option" };
  if (step.skill && config.skills.includes(step.skill) && allows("user")) return { actor: "user", reason: "skill" };
  const professional = step.professional;
  if (
    professional &&
    allows("third_party") &&
    (PROFESSIONALS as readonly ThirdParty[]).includes(professional) &&
    config.professionals.some((p) => p === professional)
  ) {
    return { actor: "third_party", reason: "professional" };
  }
  if (wants("ai") && allows("ai")) return { actor: "ai", reason: "ai_preference" };
  if (wants("third_party") && allows("third_party")) return { actor: "third_party", reason: "third_party_preference" };
  if (wants("self") && allows("user")) return { actor: "user", reason: "self_preference" };
  return { actor: step.suggestedActor, reason: "suggested" };
}

/** La tarea entra en el plan según la palanca de su línea, el nivel de validación y sus condiciones. */
export function taskApplies(task: Task, config: PlanConfig) {
  if (task.lever !== undefined && config.levers[task.lineId] !== task.lever) return false;
  if (task.validationLevel !== undefined && task.validationLevel > config.validationLevel) return false;
  const when = task.appliesWhen;
  if (when?.employed !== undefined && config.employed !== when.employed) return false;
  if (when?.hasNetwork !== undefined && config.hasNetwork !== when.hasNetwork) return false;
  return true;
}

/** Lo de Lanzar que supera el nivel elegido pasa a Operar: se lanza antes, con lo mínimo. */
export function effectivePhase(task: Task, config: PlanConfig): Task["phase"] {
  return task.phase === "launch" && task.launchLevel !== undefined && task.launchLevel > config.launchLevel
    ? "operate"
    : task.phase;
}

export { ACTORS, LEVELS, type Level };