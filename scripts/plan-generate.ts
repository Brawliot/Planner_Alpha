/**
 * Prueba "Generar" con GPT y Jev reales sobre los ejemplos y deja un informe para revisar a mano.
 * Llama a las API reales: se ejecuta a mano. Uso:
 *   npm run plan:generate              → los cuatro ejemplos
 *   npm run plan:generate -- tienda    → solo uno
 * Informe en docs/generation/<ejemplo>-<fecha>.md
 */
import { mkdir, writeFile } from "node:fs/promises";
import type { GptRequest } from "../src/lib/gpt.ts";
import type { JevAnswer, JevQuestions, JevState } from "../src/lib/jev.ts";
import type { Reply } from "../src/lib/plan/answers.ts";
import { MOLDS } from "../src/lib/plan/catalog.ts";
import { canGenerate } from "../src/lib/plan/concretion.ts";
import type { PlanConfig } from "../src/lib/plan/config.ts";
import { canDraft, readDraft, renderDraft, stepDraft } from "../src/lib/plan/draft.ts";
import {
  answerPending,
  applyGeneration,
  generateDepartment,
  generateTask,
  type GenerateDeps,
  type GenerateOutcome,
} from "../src/lib/plan/generate.ts";
import type { Department } from "../src/lib/plan/line.ts";
import { liveDeps } from "../src/lib/plan/live.ts";
import { rebuildPlan, type PlanState, type StoredPlan } from "../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../src/lib/plan/prefill.ts";
import type { Task } from "../src/lib/plan/task.ts";
import { areaVerdicts } from "../src/lib/report/verdict.ts";
import { EXAMPLES, type Example } from "./plan-examples.ts";

const MAX_TASKS = 3;
const MAX_DRAFTS = 6;

/** Reparto de cada ejemplo para que salgan pasos de IA y de terceros (plan:demo no cambia). */
const WORK: Record<string, Partial<PlanConfig>> = {
  cafe: { delegation: ["self", "ai"], professionals: ["advisor"] },
  saas: { delegation: ["ai"] },
  tienda: { delegation: ["self", "ai", "third_party"] },
  clinica: { delegation: ["ai", "third_party"], professionals: ["advisor", "lawyer"] },
};

interface CallLog {
  kind: "gpt" | "jev";
  label: string;
  ms: number;
  tokens: number | null;
  ok: boolean;
  /** Notas de Jev (noul) por pregunta. */
  scores?: Record<string, number | null>;
  /** Lo que devolvió GPT tal cual (para ver por qué se rechaza un borrador). */
  data?: unknown;
}

function traced(calls: CallLog[]): GenerateDeps {
  return {
    gpt: async <T>(request: GptRequest<T>) => {
      const start = Date.now();
      try {
        const result = await liveDeps.gpt(request);
        const usage = (result as { usage?: { input_tokens: number; output_tokens: number } | null }).usage;
        calls.push({
          kind: "gpt",
          label: request.format.name,
          ms: Date.now() - start,
          tokens: usage ? usage.input_tokens + usage.output_tokens : null,
          ok: true,
          data: result.data,
        });
        return result;
      } catch (error) {
        calls.push({ kind: "gpt", label: request.format.name, ms: Date.now() - start, tokens: null, ok: false });
        throw error;
      }
    },
    jev: async (state: JevState, questions: JevQuestions) => {
      const start = Date.now();
      try {
        const result = await liveDeps.jev(state, questions);
        const scores = Object.fromEntries(
          Object.entries(result.answers).map(([key, answer]: [string, JevAnswer | null]) => [
            key,
            answer?.type === "noul" ? Number(answer.noul.toFixed(2)) : null,
          ]),
        );
        calls.push({ kind: "jev", label: Object.keys(questions).join(", "), ms: Date.now() - start, tokens: null, ok: true, scores });
        return result;
      } catch (error) {
        calls.push({ kind: "jev", label: Object.keys(questions).join(", "), ms: Date.now() - start, tokens: null, ok: false });
        throw error;
      }
    },
  };
}

const storedOf = (plan: PlanState): StoredPlan => ({
  lines: plan.lines,
  tasks: plan.tasks,
  dismissed: plan.dismissed,
  fingerprint: plan.fingerprint,
  answers: plan.answers,
  pendingQuestions: plan.pendingQuestions,
});

async function runExample(name: string, example: Example) {
  const today = new Date().toISOString().slice(0, 10);
  const { config: prefilled } = prefillConfig(example.facts, today);
  const config: PlanConfig = { ...prefilled, ...example.config, ...WORK[name] };
  const report = { facts: example.facts, verdicts: areaVerdicts(example.facts), language: "es" as const, fingerprint: "demo" };
  const calls: CallLog[] = [];
  const deps = traced(calls);
  const out: string[] = [];
  const outcomes: { target: string; outcome: GenerateOutcome }[] = [];
  const autoAnswers: string[] = [];

  let stored: StoredPlan | null = null;
  const rebuild = () => rebuildPlan({ report, config, catalog: MOLDS, stored, today });
  let plan = rebuild();
  stored = storedOf(plan);
  const base = { idea: example.idea, facts: example.facts, language: "es" as const, config, catalog: MOLDS };

  /** Responde las preguntas pendientes con la primera opción (respuesta automática). */
  const autoAnswer = (mold: string) => {
    const pending = plan.pendingQuestions.filter((q) => q.mold === mold);
    const replies: Record<string, Reply> = Object.fromEntries(
      pending.map((q) => [q.id, { kind: "option", value: q.options[0] } satisfies Reply]),
    );
    for (const q of pending) autoAnswers.push(`- (${mold}) ${q.text} → **${q.options[0]}** · opciones: ${q.options.join(" / ")}`);
    const next = answerPending(stored!, mold, replies);
    if (next) stored = next;
    plan = rebuild();
  };

  const apply = (target: string, outcome: GenerateOutcome) => {
    outcomes.push({ target, outcome });
    stored = applyGeneration(stored!, outcome);
    plan = rebuild();
  };

  // 1) Departamentos: Ventas y el que más tareas tenga.
  const counts = new Map<Department, number>();
  for (const task of plan.tasks) {
    const line = plan.lines.find((l) => l.id === task.lineId);
    if (line) counts.set(line.department, (counts.get(line.department) ?? 0) + 1);
  }
  const biggest = [...counts.entries()].filter(([d]) => d !== "sales").sort((a, b) => b[1] - a[1])[0]?.[0];
  const departments = ["sales", ...(biggest ? [biggest] : [])] as Department[];

  let unavailable = false;
  for (const department of departments) {
    let result = await generateDepartment(deps, { ...base, plan, department });
    if (result.status === "questions") {
      stored = applyGeneration(stored, { status: "questions", mold: result.mold, questions: result.questions });
      plan = rebuild();
      autoAnswer(result.mold);
      result = await generateDepartment(deps, { ...base, plan, department });
    }
    if (result.status === "unavailable") {
      unavailable = true;
      break;
    }
    if (result.status === "done") for (const r of result.results) apply(`${department} · ${r.taskId}`, r.outcome);
  }

  // 2) Tareas sueltas de otros departamentos.
  if (!unavailable) {
    const used = new Set<Department>(departments);
    const singles: Task[] = [];
    for (const task of plan.tasks) {
      const department = plan.lines.find((l) => l.id === task.lineId)?.department;
      if (!department || used.has(department) || !canGenerate(task)) continue;
      used.add(department);
      singles.push(task);
      if (singles.length === MAX_TASKS) break;
    }
    for (const task of singles) {
      let outcome = await generateTask(deps, { ...base, plan, taskId: task.id });
      if (outcome.status === "questions") {
        stored = applyGeneration(stored, outcome);
        plan = rebuild();
        autoAnswer(outcome.mold);
        outcome = await generateTask(deps, { ...base, plan, taskId: task.id });
      }
      apply(task.id, outcome);
      if (outcome.status === "unavailable") {
        unavailable = true;
        break;
      }
    }
  }

  // 3) Borradores de los pasos de IA de las tareas generadas.
  const drafts: string[] = [];
  if (!unavailable) {
    const generated = plan.tasks.filter((t) => t.origin === "ai");
    const targets = generated.flatMap((task) => task.steps.filter(canDraft).map((step) => ({ task, step }))).slice(0, MAX_DRAFTS);
    for (const { task, step } of targets) {
      const from = calls.length;
      const result = await stepDraft(deps.gpt, {
        idea: example.idea,
        facts: example.facts,
        answers: plan.answers,
        language: "es",
        task,
        step,
        notes: null,
      });
      const draft = result.status === "draft" ? readDraft(result.step) : null;
      const rejected =
        result.status === "kept"
          ? `Motivo: **${result.reason ?? "?"}**\n\n` +
            calls
              .slice(from)
              .filter((c) => c.kind === "gpt")
              .map((c, i) => `Intento ${i + 1}:\n\n\`\`\`json\n${JSON.stringify(c.data, null, 2)}\n\`\`\`\n`)
              .join("\n")
          : "";
      drafts.push(
        `### ${task.title} → ${step.text} (${step.aiCapability})\n\nResultado: **${result.status}**\n\n` +
          (draft ? "```\n" + renderDraft(draft, "es") + "\n```\n" : "") +
          rejected +
          "\n- [ ] Me ahorra trabajo\n",
      );
      if (result.status === "unavailable") break;
    }
  }

  // ---- Informe
  const generatedOutcomes = outcomes.filter((o) => o.outcome.status === "generated");
  const kept = outcomes.filter((o) => o.outcome.status === "kept");
  const reasons = new Map<string, number>();
  for (const o of kept) if (o.outcome.status === "kept") reasons.set(o.outcome.reason, (reasons.get(o.outcome.reason) ?? 0) + 1);
  const gpt = calls.filter((c) => c.kind === "gpt");
  const jev = calls.filter((c) => c.kind === "jev");
  const tokens = gpt.reduce((sum, c) => sum + (c.tokens ?? 0), 0);
  const seconds = (calls.reduce((sum, c) => sum + c.ms, 0) / 1000).toFixed(1);
  const attempted = generatedOutcomes.length + kept.length;
  const rate = attempted > 0 ? Math.round((generatedOutcomes.length / attempted) * 100) : 0;

  out.push(`# ${example.title} · ${today}`, "", `> ${example.idea}`, "");
  out.push(`Reparto: ${config.delegation.join(" + ")} · profesionales: ${config.professionals.join(", ") || "ninguno"}`, "");
  out.push("## Métricas", "");
  out.push(`- Generadas: **${generatedOutcomes.length} de ${attempted}** (${rate} %; objetivo ≥ 80 %)`);
  out.push(`- Mantenidas como molde: ${kept.length}${reasons.size ? " · " + [...reasons].map(([r, n]) => `${r}: ${n}`).join(", ") : ""}`);
  out.push(`- Otros resultados: ${outcomes.filter((o) => !["generated", "kept"].includes(o.outcome.status)).map((o) => `${o.target}: ${o.outcome.status}`).join(", ") || "ninguno"}`);
  out.push(`- Llamadas: GPT ${gpt.length} (fallidas ${gpt.filter((c) => !c.ok).length}) · Jev ${jev.length} (fallidas ${jev.filter((c) => !c.ok).length})`);
  out.push(`- Tokens de GPT: ${tokens} · tiempo total en llamadas: ${seconds} s`);
  if (unavailable) out.push("- ⚠️ Se paró: GPT o Jev no disponibles");
  out.push("");

  out.push("## Preguntas previas (respuesta automática: la primera opción)", "", ...(autoAnswers.length ? autoAnswers : ["Ninguna."]), "");

  out.push("## Tareas generadas", "");
  for (const { target, outcome } of generatedOutcomes) {
    if (outcome.status !== "generated") continue;
    out.push(`### Molde \`${outcome.mold}\` (${target})`, "");
    for (const task of outcome.tasks) {
      out.push(`#### ${task.title}`, "", `Resultado: ${task.outcome}`, "");
      out.push(`Se apoya en: ${task.basis.join(", ") || "—"} · citas: ${(task.quotes ?? []).map((q) => `«${q}»`).join(" ") || "—"}`, "");
      for (const step of task.steps) out.push(`- (${step.actor}) ${step.text}`);
      out.push("", "- [ ] Genérica  - [ ] Útil  - [ ] Excelente", "- [ ] Afirma un hecho del mundo o una cifra inventada", "");
    }
  }

  out.push("## Borradores", "", ...(drafts.length ? drafts : ["Ninguno (no hay pasos de IA en las tareas generadas)."]), "");

  out.push("## Llamadas", "", "| # | Tipo | Qué | ms | Tokens | OK | Notas de Jev |", "|---|---|---|---|---|---|---|");
  calls.forEach((c, i) =>
    out.push(
      `| ${i + 1} | ${c.kind} | ${c.label.slice(0, 60)} | ${c.ms} | ${c.tokens ?? "—"} | ${c.ok ? "sí" : "no"} | ${
        c.scores ? Object.values(c.scores).map((s) => s ?? "—").join(", ") : ""
      } |`,
    ),
  );

  await mkdir("docs/generation", { recursive: true });
  const file = `docs/generation/${name}-${today}.md`;
  await writeFile(file, out.join("\n") + "\n");
  console.log(`${example.title}: ${generatedOutcomes.length}/${attempted} generadas, GPT ${gpt.length}, Jev ${jev.length}, ${tokens} tokens → ${file}`);
}

const arg = process.argv[2] ?? "todos";
const names = arg === "todos" ? Object.keys(EXAMPLES) : [arg];
for (const name of names) {
  const example = EXAMPLES[name];
  if (!example) {
    console.error(`Ejemplo desconocido: ${name}. Usa: todos, ${Object.keys(EXAMPLES).join(", ")}`);
    process.exit(1);
  }
  await runExample(name, example);
}