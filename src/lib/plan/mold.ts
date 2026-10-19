import type { Fact } from "../report/facts.ts";
import type { Language } from "../report/narrative.ts";
import type { CostBand, EffortBand, WaitBand } from "./bands.ts";
import type { PlanConfig } from "./config.ts";
import { findCycle, unknownDependencies } from "./graph.ts";
import type { Department } from "./line.ts";
import { knownValue, type FactKey, type FactState, type StateId } from "./states.ts";
import type { Actor, AI_CAPABILITIES, Skill, ThirdParty } from "./step.ts";
import type { Level, PHASES, TASK_KINDS } from "./task.ts";

/**
 * Molde: receta genérica de una tarea. El motor elige moldes por lo que necesitan y consiguen
 * (estados); la IA los concreta después. Sus pasos son el respaldo si la IA falla o no se usa.
 * Ninguna cifra la escribe un modelo: los tramos están aquí y los convierte bands.ts.
 */

export type Text = Record<Language, string>;

/** Dato del informe sabido con una de estas opciones (escritas con option()). */
export interface FactCondition {
  key: FactKey;
  anyOf: readonly string[];
}

/** Se cumplen todas. Un "no lo sé" de la configuración nunca coincide. */
export interface Conditions {
  facts?: readonly FactCondition[];
  employed?: boolean;
  hasNetwork?: boolean;
}

/** Tramos del paso si lo hace ese actor. Sin entrada para un actor, ese actor no puede hacerlo. */
interface ActorOption {
  effort: EffortBand;
  cost?: CostBand;
}

export interface StepOptions {
  user?: ActorOption;
  ai?: ActorOption & { capability: (typeof AI_CAPABILITIES)[number] };
  third_party?: ActorOption & { wait: WaitBand; thirdParty: ThirdParty };
}

export interface MoldStep {
  id: string;
  text: Text;
  doneWhen: Text;
  /** Pasos del mismo molde que van antes. */
  dependsOn?: readonly string[];
  /** Solo entra con este nivel o más (validación en la fase Validar; lanzamiento en las demás). */
  level?: Level;
  suggestedActor: Actor;
  skill?: Skill;
  options: StepOptions;
}

/** Regla de encaje para elegir entre moldes que consiguen lo mismo, con su motivo visible. */
export interface FitRule {
  when: Conditions;
  reason: Text;
}

export interface Mold {
  id: string;
  department: Department;
  phase: (typeof PHASES)[number];
  kind: (typeof TASK_KINDS)[number];
  title: Text;
  outcome: Text;
  needs: readonly StateId[];
  gets: readonly StateId[];
  /** Dato del informe que resuelve al terminar: consigue también su fact:. */
  unlocks?: FactKey;
  when?: Conditions;
  /** Entra si el nivel de validación elegido es >= este. */
  validationLevel?: Level;
  /** En fase Lanzar: si supera el nivel de lanzamiento elegido, pasa a Operar. */
  launchLevel?: Level;
  fit?: readonly FitRule[];
  steps: readonly MoldStep[];
}

type ConfigView = Pick<PlanConfig, "employed" | "hasNetwork" | "validationLevel" | "launchLevel">;

export function conditionsMet(conditions: Conditions | undefined, facts: readonly Fact[], config: ConfigView) {
  if (!conditions) return true;
  if (conditions.employed !== undefined && config.employed !== conditions.employed) return false;
  if (conditions.hasNetwork !== undefined && config.hasNetwork !== conditions.hasNetwork) return false;
  return (conditions.facts ?? []).every((condition) => {
    const value = knownValue(facts, condition.key);
    return value !== null && condition.anyOf.includes(value);
  });
}

/** El molde entra en el plan de este negocio: sus condiciones y el nivel de validación. */
export function moldApplies(mold: Mold, facts: readonly Fact[], config: ConfigView) {
  if (mold.validationLevel !== undefined && mold.validationLevel > config.validationLevel) return false;
  return conditionsMet(mold.when, facts, config);
}

/** Lo que consigue, incluido el dato que resuelve. */
export function moldGets(mold: Mold): StateId[] {
  const gets: StateId[] = [...mold.gets];
  if (mold.unlocks) {
    const fact: FactState = `fact:${mold.unlocks}`;
    if (!gets.includes(fact)) gets.push(fact);
  }
  return gets;
}

/** Encaje con tu situación: cuántas reglas se cumplen y sus motivos. */
export function moldFit(mold: Mold, facts: readonly Fact[], config: ConfigView) {
  const reasons = (mold.fit ?? []).filter((rule) => conditionsMet(rule.when, facts, config)).map((rule) => rule.reason);
  return { score: reasons.length, reasons };
}

/** Pasos que entran con tu nivel; las dependencias hacia pasos que se quedan fuera se quitan. */
export function stepsAt(mold: Mold, config: ConfigView): MoldStep[] {
  const level = mold.phase === "validate" ? config.validationLevel : config.launchLevel;
  const kept = mold.steps.filter((step) => (step.level ?? 1) <= level);
  const ids = new Set(kept.map((step) => step.id));
  return kept.map((step) => (step.dependsOn ? { ...step, dependsOn: step.dependsOn.filter((id) => ids.has(id)) } : step));
}

export const actorsOf = (step: MoldStep) => (Object.keys(step.options) as Actor[]).filter((a) => step.options[a]);

/** Problemas de un molde escrito a mano. Vacío = bien escrito. */
export function moldIssues(mold: Mold): string[] {
  const issues: string[] = [];
  const at = (message: string) => issues.push(`${mold.id}: ${message}`);

  if (mold.gets.length === 0 && !mold.unlocks) at("gets nothing");
  for (const state of mold.needs) if (moldGets(mold).includes(state)) at(`needs what it gets: ${state}`);
  if (!mold.steps.some((step) => (step.level ?? 1) === 1)) at("no step at level 1");

  const ids = mold.steps.map((step) => step.id);
  if (new Set(ids).size !== ids.length) at("duplicate step id");
  for (const unknown of unknownDependencies(mold.steps)) at(`unknown step dependency ${unknown}`);
  if (findCycle(mold.steps)) at("step dependency cycle");

  for (const step of mold.steps) {
    const actors = actorsOf(step);
    if (actors.length === 0) at(`step ${step.id} has no actor`);
    if (!actors.includes(step.suggestedActor)) at(`step ${step.id} suggests an actor without figures`);
    // Un paso de un nivel no puede depender de otro de nivel superior: se quedaría sin él.
    for (const id of step.dependsOn ?? []) {
      const dependency = mold.steps.find((s) => s.id === id);
      if (dependency && (dependency.level ?? 1) > (step.level ?? 1)) at(`step ${step.id} depends on a higher level`);
    }
  }
  return issues;
}