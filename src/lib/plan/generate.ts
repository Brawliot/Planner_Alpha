import type { GptRequest } from "../gpt.ts";
import type { JevAnswer, JevQuestions, JevState } from "../jev.ts";
import { usable } from "../report/areas.ts";
import type { Fact } from "../report/facts.ts";
import type { Language } from "../report/narrative.ts";
import { answersFromReplies, type DraftQuestion, type Reply } from "./answers.ts";
import { canGenerate } from "./concretion.ts";
import {
  CONCRETION_INSTRUCTIONS,
  concretionFormat,
  concretionInput,
  concretionParser,
  readGeneration,
  type ConcretionContext,
} from "./concretion-gpt.ts";
import type { PlanConfig } from "./config.ts";
import { isGoodQuestion, isSpecific, judgeState, questionQualityQuestions, specificityQuestions } from "./judge.ts";
import { isTaskProtected } from "./merge.ts";
import type { Mold } from "./mold.ts";
import type { PlanState, StoredPlan } from "./orchestrator.ts";
import type { Task } from "./task.ts";

/**
 * "Generar" de una tarea de punta a punta. GPT y Jev entran como parámetros: los tests usan
 * respuestas falsas; el envoltorio server-only usará callGpt y callJev.
 * Todo o nada: si no sale bien en MAX_GPT_CALLS llamadas, se queda el molde.
 */

export const MAX_GPT_CALLS = 3;

export interface GenerateDeps {
  gpt: <T>(request: GptRequest<T>) => Promise<{ data: T }>;
  jev: (state: JevState, questions: JevQuestions) => Promise<{ answers: Record<string, JevAnswer | null> }>;
}

export interface GenerateInput {
  idea: string;
  facts: readonly Fact[];
  language: Language;
  config: PlanConfig;
  catalog: readonly Mold[];
  /** El plan recalculado ahora (rebuildPlan). */
  plan: PlanState;
  taskId: string;
}

export type GenerateOutcome =
  | { status: "questions"; mold: string; questions: DraftQuestion[] }
  | { status: "generated"; mold: string; tasks: Task[] }
  | { status: "kept"; reason: string }
  | { status: "unavailable" }
  | { status: "not_allowed" };

/** Ids que siguen a las generadas que ya existen del molde; reescribe las dependencias internas. */
function renumber(tasks: readonly Task[], mold: string, existing: readonly Task[]): Task[] {
  const used = existing.filter((t) => t.mold === mold && t.origin === "ai").map((t) => Number(t.id.split("~")[1]) || 0);
  const start = used.length > 0 ? Math.max(...used) : 0;
  const ids = new Map(tasks.map((task, index) => [task.id, `${mold}~${start + index + 1}`]));
  return tasks.map((task) => ({
    ...task,
    id: ids.get(task.id)!,
    dependsOn: task.dependsOn.map((id) => ids.get(id) ?? id),
  }));
}

export async function generateTask(deps: GenerateDeps, input: GenerateInput): Promise<GenerateOutcome> {
  const { plan } = input;
  const moldTask = plan.tasks.find((t) => t.id === input.taskId);
  const mold = moldTask && input.catalog.find((m) => m.id === moldTask.mold);
  if (!moldTask || !mold || !canGenerate(moldTask)) return { status: "not_allowed" };

  // 33A: las preguntas pendientes se vuelven a mostrar sin llamar a nadie.
  const pending = plan.pendingQuestions.filter((q) => q.mold === mold.id);
  if (pending.length > 0) return { status: "questions", mold: mold.id, questions: pending };

  const otherTasks = plan.tasks.filter((t) => t.id !== moldTask.id && t.archived === undefined).map((t) => t.title);
  const base: Omit<ConcretionContext, "mayAsk"> = {
    idea: input.idea,
    facts: input.facts,
    mold,
    moldTask,
    lineGoal: plan.lines.find((l) => l.id === moldTask.lineId)?.goal ?? "",
    otherTasks,
    config: input.config,
    language: input.language,
    answers: plan.answers,
  };
  // 31A: si ya se preguntó por este molde, no se vuelve a preguntar.
  let mayAsk = !plan.answers.some((a) => a.mold === mold.id);
  let reason = "unknown";

  try {
    for (let call = 0; call < MAX_GPT_CALLS; call++) {
      const ctx: ConcretionContext = { ...base, mayAsk };
      const { data } = await deps.gpt({
        task: "write",
        instructions: CONCRETION_INSTRUCTIONS,
        input: concretionInput(ctx),
        format: concretionFormat(ctx),
        parse: concretionParser,
        effort: "low",
      });
      const result = readGeneration(data, ctx);

      if (result.ok && "questions" in result) {
        const target = {
          questions: result.questions,
          other_tasks: otherTasks,
          previous_answers: plan.answers.flatMap((a) => (a.answer === null ? [] : [{ question: a.question, answer: a.answer }])),
        };
        const { answers } = await deps.jev(judgeState(input.idea, input.facts, target), questionQualityQuestions(result.questions));
        const good = result.questions.filter((q) => isGoodQuestion(q.id, answers));
        if (good.length > 0) return { status: "questions", mold: mold.id, questions: good };
        reason = "bad_questions";
        mayAsk = false;
        continue;
      }

      if (!result.ok) {
        reason = result.reason;
        if (result.reason === "questions" || result.reason === "mixed") mayAsk = false;
        continue;
      }

      const drafts = result.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        outcome: t.outcome,
        steps: t.steps.map((s) => ({ id: s.id, text: s.text })),
      }));
      const { answers } = await deps.jev(judgeState(input.idea, input.facts, { tasks: drafts }), specificityQuestions(drafts));
      if (!result.tasks.every((t) => isSpecific(t.id, answers))) {
        reason = "generic";
        mayAsk = false;
        continue;
      }

      const withValues = result.tasks.map((task) => ({
        ...task,
        citedValues: Object.fromEntries(task.basis.map((key) => [key, usable(input.facts, key)?.value])),
      }));
      return { status: "generated", mold: mold.id, tasks: renumber(withValues, mold.id, plan.tasks) };
    }
  } catch (error) {
    console.error(`generate: ${error instanceof Error ? error.name : "error"} al generar ${mold.id}`);
    return { status: "unavailable" };
  }
  return { status: "kept", reason };
}

/** Guarda el resultado de "Generar" en el plan almacenado. */
export function applyGeneration(stored: StoredPlan, outcome: GenerateOutcome): StoredPlan {
  if (outcome.status === "questions") {
    const others = (stored.pendingQuestions ?? []).filter((q) => q.mold !== outcome.mold);
    return { ...stored, pendingQuestions: [...others, ...outcome.questions] };
  }
  if (outcome.status === "generated") {
    // 16A: las generadas anteriores sin tocar se rehacen; las empezadas se quedan.
    const kept = stored.tasks.filter((t) => !(t.origin === "ai" && t.mold === outcome.mold && !isTaskProtected(t)));
    return {
      ...stored,
      tasks: [...kept, ...outcome.tasks],
      pendingQuestions: (stored.pendingQuestions ?? []).filter((q) => q.mold !== outcome.mold),
    };
  }
  return stored;
}

/** Guarda las respuestas a las preguntas pendientes de un molde. null si alguna no encaja. */
export function answerPending(
  stored: StoredPlan,
  mold: string,
  replies: Readonly<Record<string, Reply | undefined>>,
): StoredPlan | null {
  const pending = (stored.pendingQuestions ?? []).filter((q) => q.mold === mold);
  if (pending.length === 0) return null;
  const answers = answersFromReplies(pending, replies);
  if (!answers) return null;
  return {
    ...stored,
    answers: [...(stored.answers ?? []), ...answers],
    pendingQuestions: (stored.pendingQuestions ?? []).filter((q) => q.mold !== mold),
  };
}