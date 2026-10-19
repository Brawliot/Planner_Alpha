import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCRETION_INSTRUCTIONS,
  buildConcretion,
  concretionFormat,
  concretionInput,
  concretionParser,
  type ConcretionContext,
  type RawConcretion,
} from "../../src/lib/plan/concretion-gpt.ts";
import { defaultConfig } from "../../src/lib/plan/config.ts";
import type { Mold } from "../../src/lib/plan/mold.ts";
import type { Task } from "../../src/lib/plan/task.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";

const known = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});
const t = (s: string) => ({ en: s, es: s });

const MOLD: Mold = {
  id: "find_premises",
  department: "operations",
  phase: "prepare",
  kind: "action",
  title: t("Busca y firma tu local"),
  outcome: t("Un local firmado"),
  needs: [],
  gets: ["premises_signed"],
  unlocks: ["rent_level"],
  steps: [
    {
      id: "criteria",
      text: t("Fija tamaño y zona"),
      doneWhen: t("Tienes criterios"),
      suggestedActor: "user",
      options: { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
    },
    {
      id: "sign",
      text: t("Firma"),
      doneWhen: t("Firmado"),
      suggestedActor: "user",
      options: {
        user: { effort: "4_8h" },
        third_party: { effort: "1_4h", wait: "under_1w", cost: "100_500", thirdParty: "lawyer" },
      },
    },
  ],
};

const MOLD_TASK = { id: "find_premises", lineId: "base:operations", phase: "prepare" } as Task;
const IDEA = "Una cafetería de especialidad en mi barrio con 20 plazas";

const CTX: ConcretionContext = {
  idea: IDEA,
  facts: [known("sector", "Hospitality/Food service"), { key: "competition", value: "Not specified", source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" } }],
  mold: MOLD,
  moldTask: MOLD_TASK,
  lineGoal: "Local listo",
  otherTasks: ["Define tu oferta y tus precios"],
  config: defaultConfig("2026-10-19", { min: 10, max: 20 }),
  language: "es",
};

const step = (moldStep: string, text: string, afterPrevious = false) => ({
  text,
  done_when: `${text}: hecho`,
  mold_step: moldStep,
  after_previous: afterPrevious,
});

const VALID: RawConcretion = {
  tasks: [
    {
      title: "Define el local para 20 plazas",
      outcome: "Criterios claros",
      after_previous: false,
      cited_facts: ["sector"],
      quotes: ["cafetería de especialidad"],
      steps: [step("criteria", "Apunta cuánta barra y mesas necesitas"), step("criteria", "Marca las calles de tu barrio", true)],
    },
    {
      title: "Firma el local elegido",
      outcome: "Contrato firmado",
      after_previous: true,
      cited_facts: [],
      quotes: ["en mi barrio"],
      steps: [step("sign", "Firma el contrato")],
    },
  ],
};

const withTasks = (tasks: RawConcretion["tasks"]): RawConcretion => ({ tasks });

describe("entrada y formato", () => {
  it("las instrucciones nunca llevan texto del usuario", () => {
    assert.ok(!CONCRETION_INSTRUCTIONS.includes(IDEA));
  });

  it("GPT solo ve datos utilizables y los pasos del molde de tu nivel", () => {
    const input = concretionInput(CTX);
    assert.deepEqual(input.facts.map((f) => f.key), ["sector"]);
    assert.deepEqual(input.mold_task.steps.map((s) => s.id), ["criteria", "sign"]);
  });

  it("las claves citables y los pasos del molde son listas cerradas", () => {
    const schema = concretionFormat(CTX).schema as {
      properties: { tasks: { items: { properties: { cited_facts: { items: { enum: string[] } }; steps: { items: { properties: { mold_step: { enum: string[] } } } } } } } };
    };
    const task = schema.properties.tasks.items.properties;
    assert.deepEqual(task.cited_facts.items.enum, ["sector"]);
    assert.deepEqual(task.steps.items.properties.mold_step.enum, ["criteria", "sign"]);
  });

  it("el parser exige al menos un paso por tarea", () => {
    assert.equal(concretionParser.safeParse(withTasks([{ ...VALID.tasks[0], steps: [] }])).success, false);
  });
});

describe("buildConcretion", () => {
  it("válido: tareas con la línea y la fase del molde, citas, dependencias y cifras del molde", () => {
    const result = buildConcretion(VALID, CTX);
    assert.ok(result.ok);
    const [first, second] = result.tasks;
    assert.deepEqual(result.tasks.map((x) => x.id), ["find_premises~1", "find_premises~2"]);
    assert.deepEqual([first.lineId, first.phase, first.origin, first.mold], ["base:operations", "prepare", "ai", "find_premises"]);
    assert.deepEqual(first.basis, ["sector"]);
    assert.deepEqual(second.quotes, ["en mi barrio"]);
    assert.deepEqual(second.dependsOn, ["find_premises~1"]);
    assert.deepEqual(first.steps[1].dependsOn, ["s1"]);
    // Dos pasos concretan "criteria" (1–4 h): se reparte.
    assert.deepEqual(first.steps[0].effort, { min: 0.5, max: 2 });
    assert.deepEqual(first.steps[0].allowedActors, ["user", "ai"]);
    // El dato del molde, en la última.
    assert.equal(first.unlocks, undefined);
    assert.deepEqual(second.unlocks, ["rent_level"]);
  });

  it("más de 3 tareas o ninguna: se descarta todo", () => {
    const many = withTasks([VALID.tasks[0], VALID.tasks[0], VALID.tasks[0], VALID.tasks[1]]);
    assert.deepEqual(buildConcretion(many, CTX), { ok: false, reason: "count" });
    assert.deepEqual(buildConcretion(withTasks([]), CTX), { ok: false, reason: "count" });
  });

  it("citas: dato inventado o no utilizable, frase que no está en la idea o sin citas", () => {
    const bad = (task: Partial<RawConcretion["tasks"][number]>) =>
      buildConcretion(withTasks([{ ...VALID.tasks[0], ...task }, VALID.tasks[1]]), CTX);
    assert.deepEqual(bad({ cited_facts: ["budget_eur"] }), { ok: false, reason: "citations" });
    assert.deepEqual(bad({ cited_facts: ["competition"] }), { ok: false, reason: "citations" });
    assert.deepEqual(bad({ quotes: ["en el centro de Madrid"] }), { ok: false, reason: "citations" });
    assert.deepEqual(bad({ cited_facts: [], quotes: [] }), { ok: false, reason: "citations" });
  });

  it("cifras: solo las que están en los datos", () => {
    const priced = withTasks([{ ...VALID.tasks[0], title: "Busca un local de 300 euros al mes" }, VALID.tasks[1]]);
    assert.deepEqual(buildConcretion(priced, CTX), { ok: false, reason: "numbers" });
    // "20" está en la idea.
    assert.ok(buildConcretion(VALID, CTX).ok);
  });

  it("pasos del molde: inventados o sin cubrir", () => {
    const invented = withTasks([{ ...VALID.tasks[0], steps: [step("visit", "Visita")] }, VALID.tasks[1]]);
    assert.deepEqual(buildConcretion(invented, CTX), { ok: false, reason: "mold_step" });
    assert.deepEqual(buildConcretion(withTasks([VALID.tasks[0]]), CTX), { ok: false, reason: "coverage" });
  });
});