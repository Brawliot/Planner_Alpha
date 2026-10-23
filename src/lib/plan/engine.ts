import { buildAreas, type AreaKey } from "../report/areas.ts";
import type { Fact } from "../report/facts.ts";
import { reportTexts } from "../report/i18n.ts";
import type { Language } from "../report/narrative.ts";
import type { AreaVerdict } from "../report/verdict.ts";
import { costOf, effortOf, waitOf } from "./bands.ts";
import { effectivePhase, resolveActor, type PlanConfig } from "./config.ts";
import { launchGoal, lineGoal } from "./goals.ts";
import { DEPARTMENTS, type Department, type Line, type LineSource } from "./line.ts";
import { actorsOf, moldApplies, moldFit, moldGets, stepsAt, type Mold, type MoldStep } from "./mold.ts";
import { BUSINESS_STATE_LABELS, currentStates, type BusinessState, type StateId } from "./states.ts";
import type { Step } from "./step.ts";
import { PHASES, taskGraphIssues, type Task } from "./task.ts";

/**
 * Motor por objetivos: del informe, la configuración y el catálogo al esqueleto del plan.
 * Encadena hacia atrás desde los objetivos de cada línea y la meta de lanzamiento, partiendo de lo
 * que ya es verdad. Cada molde entra una sola vez (id de la tarea = id del molde), en la línea más
 * prioritaria que lo pide. Función pura: no guarda nada ni llama a modelos.
 */

const AREA_DEPARTMENT: Record<AreaKey, Department> = {
  concept: "product",
  validation: "product",
  market: "sales",
  competition: "sales",
  money: "finance",
  founder: "founder",
  location: "operations",
  regulation: "legal",
  team: "team",
  dependencies: "operations",
};

/** Caminos empatados: se planifica el provisional (el más barato en horas) hasta que decidas. */
export interface Decision {
  state: StateId;
  options: string[];
  chosen: string;
  taskId: string;
}

export interface Skeleton {
  lines: Line[];
  tasks: Task[];
  decisions: Decision[];
  /** Debe estar vacío: estados inalcanzables, rojos sin objetivo o ciclos. Lo vigilan los tests. */
  issues: string[];
}

const DECIDE: Record<Language, { title: (goal: string) => string; doneWhen: string }> = {
  en: { title: (goal) => `Decide how to get: ${goal}`, doneWhen: "You have chosen one of the options" },
  es: { title: (goal) => `Decide cómo conseguir: ${goal}`, doneWhen: "Has elegido una de las opciones" },
};

export function stateLabel(state: StateId, language: Language) {
  if (state.startsWith("fact:")) {
    const key = state.slice("fact:".length);
    return reportTexts(language).field[key] ?? key;
  }
  return BUSINESS_STATE_LABELS[state as BusinessState][language];
}

const goalText = (states: readonly StateId[], language: Language) =>
  states.map((state) => stateLabel(state, language)).join(", ");

/** Líneas que salen del informe, en orden de prioridad: rojos, amarillos, grises, por concretar, estimados. */
function reportLineSources(facts: readonly Fact[], verdicts: readonly AreaVerdict[]) {
  const lines: { id: string; area: AreaKey; source: LineSource }[] = [];
  for (const v of verdicts) {
    if (v.verdict === "risk") lines.push({ id: `risk:${v.area}`, area: v.area, source: { kind: "risk", area: v.area, reason: v.reason } });
  }
  for (const v of verdicts) {
    if (v.verdict === "doubt") lines.push({ id: `doubt:${v.area}`, area: v.area, source: { kind: "doubt", area: v.area, reason: v.reason } });
  }
  for (const v of verdicts) {
    if (v.verdict === "needs_info" && v.missing.length > 0) {
      lines.push({ id: `needs_info:${v.area}`, area: v.area, source: { kind: "needs_info", area: v.area, keys: v.missing } });
    }
  }
  for (const v of verdicts) {
    if (v.gaps.length > 0) lines.push({ id: `gaps:${v.area}`, area: v.area, source: { kind: "gaps", area: v.area, keys: v.gaps } });
  }
  for (const view of buildAreas(facts)) {
    const keys = view.inputs.filter((input) => input.certainty === "estimated").map((input) => input.key);
    if (keys.length > 0) lines.push({ id: `estimated:${view.area}`, area: view.area, source: { kind: "estimated", area: view.area, keys } });
  }
  return lines;
}

/** Paso del plan a partir de un paso de molde: actor según tu configuración y cifras de sus tramos. */
export function buildStep(step: MoldStep, order: number, config: PlanConfig, language: Language): Step {
  const allowedActors = actorsOf(step);
  const { actor } = resolveActor(
    { allowedActors, suggestedActor: step.suggestedActor, skill: step.skill, professional: step.options.third_party?.thirdParty },
    config,
  );
  const base = {
    id: step.id,
    order,
    text: step.text[language],
    doneWhen: step.doneWhen[language],
    suggestedActor: step.suggestedActor,
    allowedActors,
    actor,
    status: "todo" as const,
    ...(step.dependsOn && step.dependsOn.length > 0 ? { dependsOn: [...step.dependsOn] } : {}),
    ...(step.skill ? { skill: step.skill } : {}),
  };
  switch (actor) {
    case "user": {
      const option = step.options.user!;
      return { ...base, effort: effortOf(option.effort), ...(option.cost ? { cost: costOf(option.cost) } : {}) };
    }
    case "ai": {
      const option = step.options.ai!;
      return {
        ...base,
        effort: effortOf(option.effort),
        aiCapability: option.capability,
        ...(option.cost ? { cost: costOf(option.cost) } : {}),
      };
    }
    case "third_party": {
      const option = step.options.third_party!;
      return {
        ...base,
        effort: effortOf(option.effort),
        thirdParty: option.thirdParty,
        wait: waitOf(option.wait),
        ...(option.cost ? { cost: costOf(option.cost) } : {}),
      };
    }
  }
}

function buildTask(mold: Mold, lineId: string, dependsOn: string[], config: PlanConfig, language: Language): Task {
  const task: Task = {
    id: mold.id,
    lineId,
    phase: mold.phase,
    kind: mold.kind,
    title: mold.title[language],
    outcome: mold.outcome[language],
    dependsOn,
    // Lo que el molde exige del informe: siempre sabido (si no, no aplicaría).
    basis: [...new Set((mold.when?.facts ?? []).map((condition) => condition.key))],
    validation: "per_step",
    origin: "catalog",
    mold: mold.id,
    steps: stepsAt(mold, config).map((step, index) => buildStep(step, index, config, language)),
    ...(mold.unlocks && mold.unlocks.length > 0 ? { unlocks: [...mold.unlocks] } : {}),
    ...(mold.validationLevel ? { validationLevel: mold.validationLevel } : {}),
    ...(mold.launchLevel ? { launchLevel: mold.launchLevel } : {}),
  };
  return { ...task, phase: effectivePhase(task, config) };
}

const specificity = (mold: Mold) =>
  (mold.when?.facts?.length ?? 0) + (mold.when?.employed !== undefined ? 1 : 0) + (mold.when?.hasNetwork !== undefined ? 1 : 0);

function bestOf(molds: Mold[], score: (mold: Mold) => number) {
  const max = Math.max(...molds.map(score));
  return molds.filter((mold) => score(mold) === max);
}

/** Orden estable: dependencias primero; entre las listas, por fase y por orden del catálogo. */
function ordered(tasks: Task[], key: Map<string, [number, number]>) {
  const ids = new Set(tasks.map((task) => task.id));
  const done = new Set<string>();
  const compare = (a: Task, b: Task) => {
    const [pa, ca] = key.get(a.id)!;
    const [pb, cb] = key.get(b.id)!;
    return pa - pb || ca - cb;
  };
  const result: Task[] = [];
  let left = [...tasks];
  while (left.length > 0) {
    const ready = left.filter((task) => task.dependsOn.every((id) => !ids.has(id) || done.has(id))).sort(compare);
    // Con un ciclo no hay ninguna lista: se sigue por prioridad y el ciclo queda en issues.
    const next = ready[0] ?? [...left].sort(compare)[0];
    result.push(next);
    done.add(next.id);
    left = left.filter((task) => task !== next);
  }
  return result;
}

export function buildSkeleton(input: {
  facts: readonly Fact[];
  verdicts: readonly AreaVerdict[];
  config: PlanConfig;
  catalog: readonly Mold[];
  /** Lo que consiguen las tareas ya terminadas del plan. */
  achieved: readonly { state: StateId; taskId: string }[];
  language: Language;
}): Skeleton {
  const { facts, config, catalog, language } = input;
  const satisfied = new Set(currentStates({ facts, config, achieved: input.achieved }).keys());
  const applicable = catalog.filter((mold) => moldApplies(mold, facts, config));
  const byId = new Map(catalog.map((mold) => [mold.id, mold]));
  /** Qué molde del plan consigue cada estado. */
  const provider = new Map<StateId, string>();
  /** Molde elegido → línea del informe que lo pidió primero (null: solo lo pide el lanzamiento). */
  const owner = new Map<string, string | null>();
  const decisions: Omit<Decision, "taskId">[] = [];
  const issues: string[] = [];

  const effortMax = (mold: Mold) =>
    stepsAt(mold, config).reduce((sum, step) => sum + effortOf(step.options[step.suggestedActor]!.effort).max, 0);

  const pick = (state: StateId, candidates: Mold[]): { mold: Mold; tied?: Mold[] } => {
    const chosenByUser = candidates.find((mold) => mold.id === config.levers[state]);
    if (chosenByUser) return { mold: chosenByUser };
    const best = bestOf(bestOf(candidates, specificity), (mold) => moldFit(mold, facts, config).score);
    if (best.length === 1) return { mold: best[0] };
    // sort es estable: a igual esfuerzo, manda el orden del catálogo.
    return { mold: [...best].sort((a, b) => effortMax(a) - effortMax(b))[0], tied: best };
  };

  /**
   * direct: el estado es objetivo de la línea (la tarea es suya sea del departamento que sea).
   * Si es un requisito, se queda en la línea solo si es de su mismo departamento; si no, va a su base.
   */
  const achieve = (state: StateId, lineId: string | null, direct: boolean) => {
    if (satisfied.has(state)) return;
    const existing = provider.get(state);
    if (existing) {
      // Una línea del informe que lo pide directamente se queda la tarea que había ido a la base.
      if (direct && lineId !== null && owner.get(existing) === null) owner.set(existing, lineId);
      return;
    }
    const candidates = applicable.filter((mold) => moldGets(mold).includes(state));
    if (candidates.length === 0) {
      issues.push(`unreachable ${state}`);
      return;
    }
    const { mold, tied } = pick(state, candidates);
    for (const got of moldGets(mold)) if (!provider.has(got)) provider.set(got, mold.id);
    if (tied) decisions.push({ state, options: tied.map((m) => m.id), chosen: mold.id });
    if (owner.has(mold.id)) return;
    const sameDepartment = lineId !== null && lineDepartment.get(lineId) === mold.department;
    const assigned = direct || sameDepartment ? lineId : null;
    owner.set(mold.id, assigned);
    for (const need of mold.needs) achieve(need, assigned, false);
  };

  const reportLines = reportLineSources(facts, input.verdicts);
  const lineDepartment = new Map(reportLines.map((line) => [line.id, AREA_DEPARTMENT[line.area]]));
  const goals = new Map<string, StateId[]>();
  for (const line of reportLines) {
    const goal = lineGoal(line.source, facts);
    if (goal === null) {
      issues.push(`no goal for ${line.id}`);
      continue;
    }
    goals.set(line.id, goal);
    for (const state of goal) achieve(state, line.id, true);
  }
  const launch = launchGoal(facts, config.launchLevel);
  for (const state of launch) achieve(state, null, true);

  const lineOf = (moldId: string) => owner.get(moldId) ?? `base:${byId.get(moldId)!.department}`;
  const decideId = (state: StateId) => `decide:${state}`;
  const decisionOf = new Map(decisions.map((d) => [d.chosen, decideId(d.state)]));

  const tasks: Task[] = [...owner.keys()].map((id) => {
    const mold = byId.get(id)!;
    const dependsOn = new Set<string>();
    for (const need of mold.needs) {
      const from = provider.get(need);
      if (!satisfied.has(need) && from && from !== id) dependsOn.add(from);
    }
    const decision = decisionOf.get(id);
    if (decision) dependsOn.add(decision);
    // Abrir es lo último: los primeros clientes esperan a todo lo demás que pide el lanzamiento.
    if (moldGets(mold).includes("first_customers")) {
      for (const state of launch) {
        const from = provider.get(state);
        if (state !== "first_customers" && !satisfied.has(state) && from && from !== id) dependsOn.add(from);
      }
    }
    return buildTask(mold, lineOf(id), [...dependsOn], config, language);
  });

  const key = new Map<string, [number, number]>(
    tasks.map((task) => [task.id, [PHASES.indexOf(task.phase), catalog.indexOf(byId.get(task.id)!)]]),
  );
  for (const decision of decisions) {
    const chosen = tasks.find((task) => task.id === decision.chosen)!;
    const title = DECIDE[language].title(stateLabel(decision.state, language));
    tasks.push({
      id: decideId(decision.state),
      lineId: chosen.lineId,
      phase: chosen.phase,
      kind: "decision",
      title,
      outcome: title,
      dependsOn: [],
      basis: [],
      validation: "per_step",
      origin: "catalog",
      steps: [
        {
          id: "choose",
          order: 0,
          text: title,
          doneWhen: DECIDE[language].doneWhen,
          suggestedActor: "user",
          allowedActors: ["user"],
          actor: "user",
          effort: effortOf("under_1h"),
          status: "todo",
        },
      ],
    });
    key.set(decideId(decision.state), [PHASES.indexOf(chosen.phase), key.get(chosen.id)![1] - 0.5]);
  }

  const used = new Set(tasks.map((task) => task.lineId));
  const lines: Line[] = reportLines
    .filter((line) => used.has(line.id))
    .map((line) => ({
      id: line.id,
      department: AREA_DEPARTMENT[line.area],
      source: line.source,
      goal: goalText(goals.get(line.id)!, language),
    }));
  for (const department of DEPARTMENTS) {
    const id = `base:${department}`;
    if (!used.has(id)) continue;
    const own = [...owner.keys()].filter((moldId) => lineOf(moldId) === id);
    const fromLaunch = launch.filter((state) => own.includes(provider.get(state) ?? ""));
    const states = fromLaunch.length > 0 ? fromLaunch : own.flatMap((moldId) => moldGets(byId.get(moldId)!));
    lines.push({ id, department, source: { kind: "base" }, goal: goalText(states, language) });
  }

  issues.push(...taskGraphIssues(tasks));
  return {
    lines,
    tasks: ordered(tasks, key),
    decisions: decisions.map((d) => ({ ...d, taskId: decideId(d.state) })),
    // Dos líneas pueden pedir lo mismo: cada problema una sola vez.
    issues: [...new Set(issues)],
  };
}