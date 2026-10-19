import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GptRequest } from "../../src/lib/gpt.ts";
import type { JevQuestions } from "../../src/lib/jev.ts";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { defaultConfig, type PlanConfig } from "../../src/lib/plan/config.ts";
import {
  answerPending,
  applyGeneration,
  generateDepartment,
  generateTask,
  outdatedGenerated,
  type GenerateDeps,
  type GenerateInput,
} from "../../src/lib/plan/generate.ts";
import type { Task } from "../../src/lib/plan/task.ts";
import { stepsAt } from "../../src/lib/plan/mold.ts";
import { rebuildPlan, type StoredPlan } from "../../src/lib/plan/orchestrator.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";

const known = (key: string, value: unknown): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});
const IDEA = "Una cafetería de especialidad en mi barrio";
const FACTS: Fact[] = [
  known("sector", "Hospitality/Food service"),
  known("offering_type", "Physical venue"),
  known("revenue_model", "One-time sale"),
  known("customer_segment", "Consumers"),
  known("validation_stage", "Idea only"),
  known("founder_experience", "Over 5 years"),
  known("time_commitment", "Full time"),
  known("competition", "Few competitors"),
];
const CONFIG: PlanConfig = { ...defaultConfig("2026-10-19", { min: 20, max: 40 }), launchLevel: 1 };
const MOLD = MOLDS.find((m) => m.id === "find_premises")!;
const MOLD_STEPS = stepsAt(MOLD, CONFIG).map((s) => s.id);

const planFrom = (stored: StoredPlan | null) =>
  rebuildPlan({
    report: { facts: FACTS, verdicts: areaVerdicts(FACTS), language: "es", fingerprint: "x" },
    config: CONFIG,
    catalog: MOLDS,
    stored,
    today: "2026-10-19",
  });
const input = (stored: StoredPlan | null = null): GenerateInput => ({
  idea: IDEA,
  facts: FACTS,
  language: "es",
  config: CONFIG,
  catalog: MOLDS,
  plan: planFrom(stored),
  taskId: "find_premises",
});

/** Una tarea que cubre todos los pasos del molde y cita el sector. */
const TASKS = {
  questions: [],
  tasks: [
    {
      title: "Busca un local de cafetería en tu barrio",
      outcome: "Un local firmado",
      after_previous: false,
      cited_facts: ["sector"],
      quotes: [],
      steps: MOLD_STEPS.map((id) => ({ text: `Paso ${id}`, done_when: "Hecho", mold_step: id, after_previous: false })),
    },
  ],
};
const QUESTIONS = { questions: [{ text: "¿Tienes zona en mente?", options: ["Sí", "No"] }], tasks: [] };

/** GPT falso: devuelve las respuestas en orden (o lanza un error) y guarda lo que se le pidió. */
function fakeGpt(responses: unknown[]) {
  const calls: GptRequest<unknown>[] = [];
  const gpt: GenerateDeps["gpt"] = async <T>(request: GptRequest<T>) => {
    calls.push(request as GptRequest<unknown>);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { data: request.parse.parse(next) };
  };
  return { gpt, calls };
}
/** Jev falso: misma puntuación noul para todas las preguntas de cada llamada, en orden. */
function fakeJev(scores: number[]) {
  let calls = 0;
  const jev: GenerateDeps["jev"] = async (_state, questions: JevQuestions) => {
    const noul = scores[calls++] ?? 0;
    return { answers: Object.fromEntries(Object.keys(questions).map((k) => [k, { type: "noul" as const, noul }])) };
  };
  return { jev, calls: () => calls };
}

describe("generateTask", () => {
  it("tareas válidas y específicas: generadas, con el valor de lo que citan", async () => {
    const { gpt } = fakeGpt([TASKS]);
    const out = await generateTask({ gpt, jev: fakeJev([0.9]).jev }, input());
    assert.equal(out.status, "generated");
    if (out.status !== "generated") return;
    assert.deepEqual(out.tasks.map((t) => t.id), ["find_premises~1"]);
    assert.deepEqual(out.tasks[0].citedValues, { sector: "Hospitality/Food service" });
  });

  it("preguntas buenas: se devuelven; la próxima vez, las mismas sin llamar a nadie", async () => {
    const { gpt, calls } = fakeGpt([QUESTIONS]);
    const first = await generateTask({ gpt, jev: fakeJev([0.9]).jev }, input());
    assert.equal(first.status, "questions");
    const stored = applyGeneration({ lines: [], tasks: [], dismissed: [], fingerprint: "x" }, first);
    const again = await generateTask({ gpt, jev: fakeJev([]).jev }, input(stored));
    assert.equal(again.status, "questions");
    assert.equal(calls.length, 1);
  });

  it("preguntas malas: vuelve a pedir sin preguntar y genera", async () => {
    const { gpt, calls } = fakeGpt([QUESTIONS, TASKS]);
    const out = await generateTask({ gpt, jev: fakeJev([0.2, 0.9]).jev }, input());
    assert.equal(out.status, "generated");
    assert.equal((calls[1].input as { may_ask: boolean }).may_ask, false);
  });

  it("genérica la primera vez y específica la segunda: generada con dos llamadas", async () => {
    const { gpt, calls } = fakeGpt([TASKS, TASKS]);
    const out = await generateTask({ gpt, jev: fakeJev([0.1, 0.9]).jev }, input());
    assert.equal(out.status, "generated");
    assert.equal(calls.length, 2);
  });

  it("si nunca sale bien, como mucho 3 llamadas y se queda el molde con el motivo", async () => {
    const bad = { ...TASKS, tasks: [{ ...TASKS.tasks[0], cited_facts: [], quotes: [] }] };
    const { gpt, calls } = fakeGpt([bad, bad, bad, bad]);
    const out = await generateTask({ gpt, jev: fakeJev([]).jev }, input());
    assert.deepEqual(out, { status: "kept", reason: "citations" });
    assert.equal(calls.length, 3);
  });

  it("si GPT falla: no disponible, sin cambios", async () => {
    const { gpt } = fakeGpt([new Error("down")]);
    assert.deepEqual(await generateTask({ gpt, jev: fakeJev([]).jev }, input()), { status: "unavailable" });
  });

  it("una tarea que no sale de un molde o no existe: no se puede generar", async () => {
    const { gpt } = fakeGpt([]);
    assert.deepEqual(await generateTask({ gpt, jev: fakeJev([]).jev }, { ...input(), taskId: "nope" }), { status: "not_allowed" });
  });
});

describe("guardar en el plan", () => {
  const EMPTY: StoredPlan = { lines: [], tasks: [], dismissed: [], fingerprint: "x" };

  it("tras responder, no se vuelve a preguntar por ese molde y genera", async () => {
    const asked = applyGeneration(EMPTY, { status: "questions", mold: "find_premises", questions: [{ id: "a1", mold: "find_premises", text: "¿Zona?", options: ["Sí", "No"] }] });
    const answered = answerPending(asked, "find_premises", { a1: { kind: "option", value: "Sí" } });
    assert.ok(answered);
    assert.deepEqual(answered.pendingQuestions, []);
    assert.equal(answered.answers?.[0].answer, "Sí");
    const { gpt, calls } = fakeGpt([TASKS]);
    const out = await generateTask({ gpt, jev: fakeJev([0.9]).jev }, input(answered));
    assert.equal(out.status, "generated");
    assert.equal((calls[0].input as { may_ask: boolean }).may_ask, false);
  });

  it("respuestas que no encajan: nada", () => {
    const asked = applyGeneration(EMPTY, { status: "questions", mold: "m", questions: [{ id: "a1", mold: "m", text: "¿?", options: ["Sí", "No"] }] });
    assert.equal(answerPending(asked, "m", { a1: { kind: "option", value: "Quizá" } }), null);
  });

  it("al guardar lo generado, el plan lo usa en lugar del molde", () => {
    const tasks = [{ ...planFrom(null).tasks.find((t) => t.id === "find_premises")!, id: "find_premises~1", origin: "ai" as const }];
    const stored = applyGeneration(EMPTY, { status: "generated", mold: "find_premises", tasks });
    const plan = planFrom(stored);
    assert.ok(plan.tasks.some((t) => t.id === "find_premises~1"));
    assert.ok(!plan.tasks.some((t) => t.id === "find_premises"));
  });
});


/** GPT falso que responde bien a cualquier molde: lee sus pasos de la petición y los cubre todos. */
function coveringGpt() {
  const calls: GptRequest<unknown>[] = [];
  const gpt: GenerateDeps["gpt"] = async <T>(request: GptRequest<T>) => {
    calls.push(request as GptRequest<unknown>);
    if (request.format.name === "questions") return { data: request.parse.parse({ questions: [] }) };
    const steps = (request.input as { mold_task: { steps: { id: string }[] } }).mold_task.steps;
    const raw = {
      questions: [],
      tasks: [
        {
          title: "Tarea concreta de tu cafetería",
          outcome: "Hecha",
          after_previous: false,
          cited_facts: ["sector"],
          quotes: [],
          steps: steps.map((s) => ({ text: `Paso ${s.id}`, done_when: "Hecho", mold_step: s.id, after_previous: false })),
        },
      ],
    };
    return { data: request.parse.parse(raw) };
  };
  return { gpt, calls };
}

describe("aviso de 'ha cambiado'", () => {
  const generated = (extra: Partial<Task> = {}): Task => ({
    ...planFrom(null).tasks.find((t) => t.id === "find_premises")!,
    id: "find_premises~1",
    origin: "ai",
    basis: ["sector"],
    citedValues: { sector: "Hospitality/Food service" },
    ...extra,
  });

  it("si nada ha cambiado, no avisa", () => {
    assert.deepEqual(outdatedGenerated([generated()], FACTS, IDEA, []), []);
  });

  it("dato citado distinto o que ya no se sabe: avisa, y se puede regenerar si no está empezada", () => {
    const changed = [known("sector", "Retail/Commerce")];
    assert.deepEqual(outdatedGenerated([generated()], changed, IDEA, []), [{ taskId: "find_premises~1", canRegenerate: true }]);
    assert.equal(outdatedGenerated([generated()], [], IDEA, []).length, 1);
    const started = generated();
    started.steps = started.steps.map((s, i) => (i === 0 ? { ...s, status: "done" as const } : s));
    assert.deepEqual(outdatedGenerated([started], changed, IDEA, []), [{ taskId: "find_premises~1", canRegenerate: false }]);
  });

  it("frase citada que ya no está en la idea ni en las respuestas: avisa", () => {
    const quoted = generated({ quotes: ["cerca del mercado"] });
    const answers = [{ id: "find_premises#1", mold: "find_premises", question: "¿Zona?", answer: "cerca del mercado" }];
    assert.deepEqual(outdatedGenerated([quoted], FACTS, IDEA, answers), []);
    assert.equal(outdatedGenerated([quoted], FACTS, IDEA, []).length, 1);
  });
});

describe("regenerar", () => {
  it("una generada sin tocar se regenera con id nuevo, y la anterior se quita al guardar", async () => {
    const first = await generateTask({ gpt: coveringGpt().gpt, jev: fakeJev([0.9]).jev }, input());
    assert.equal(first.status, "generated");
    const stored = applyGeneration({ lines: [], tasks: [], dismissed: [], fingerprint: "x" }, first);
    const again = await generateTask({ gpt: coveringGpt().gpt, jev: fakeJev([0.9]).jev }, { ...input(stored), taskId: "find_premises~1" });
    assert.equal(again.status, "generated");
    if (again.status !== "generated") return;
    assert.deepEqual(again.tasks.map((t) => t.id), ["find_premises~2"]);
    const after = applyGeneration(stored, again);
    assert.deepEqual(after.tasks.map((t) => t.id), ["find_premises~2"]);
  });
});

describe("generar un departamento", () => {
  const QUESTIONS_ONLY = { questions: [{ text: "¿Tienes zona en mente?", options: ["Sí", "No"] }] };

  it("primero una ronda de preguntas para todo el departamento", async () => {
    const { gpt } = fakeGpt([QUESTIONS_ONLY]);
    const out = await generateDepartment({ gpt, jev: fakeJev([0.9]).jev }, { ...input(), department: "operations" });
    assert.equal(out.status, "questions");
    if (out.status !== "questions") return;
    assert.equal(out.mold, "dept:operations");
    assert.deepEqual(out.questions.map((q) => q.id), ["dept:operations#1"]);
  });

  it("respondidas, genera cada tarea sin tocar del departamento sin más preguntas", async () => {
    const asked = applyGeneration(
      { lines: [], tasks: [], dismissed: [], fingerprint: "x" },
      { status: "questions", mold: "dept:operations", questions: [{ id: "dept:operations#1", mold: "dept:operations", text: "¿Zona?", options: ["Sí", "No"] }] },
    );
    const answered = answerPending(asked, "dept:operations", { "dept:operations#1": { kind: "option", value: "Sí" } })!;
    const { gpt, calls } = coveringGpt();
    const out = await generateDepartment({ gpt, jev: fakeJev(Array(20).fill(0.9)).jev }, { ...input(answered), department: "operations" });
    assert.equal(out.status, "done");
    if (out.status !== "done") return;
    assert.ok(out.results.length > 0);
    assert.ok(out.results.every((r) => r.outcome.status === "generated"));
    assert.ok(calls.every((c) => (c.input as { may_ask?: boolean }).may_ask !== true));
  });

  it("sin tareas que generar: nada", async () => {
    const { gpt, calls } = fakeGpt([]);
    const out = await generateDepartment({ gpt, jev: fakeJev([]).jev }, { ...input(), department: "team" });
    assert.deepEqual(out, { status: "done", results: [] });
    assert.equal(calls.length, 0);
  });
});