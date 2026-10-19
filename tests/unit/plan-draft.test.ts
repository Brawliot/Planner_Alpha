import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GptRequest } from "../../src/lib/gpt.ts";
import {
  canDraft,
  draftFormat,
  editDraft,
  readDraft,
  renderDraft,
  reviewDraft,
  stepDraft,
  validateDraft,
  type DraftContext,
  type RawDraft,
} from "../../src/lib/plan/draft.ts";
import type { Step } from "../../src/lib/plan/step.ts";
import type { Task } from "../../src/lib/plan/task.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";

const known = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});

const step = (capability: Step["aiCapability"], extra: Partial<Step> = {}): Step => ({
  id: "s1",
  order: 0,
  text: "Compara 3 proveedores de café",
  doneWhen: "Tienes una tabla",
  suggestedActor: "ai",
  allowedActors: ["user", "ai"],
  actor: "ai",
  aiCapability: capability,
  effort: { min: 0.25, max: 1 },
  status: "todo",
  ...extra,
});

const task = (s: Step): Task => ({
  id: "suppliers",
  lineId: "base:operations",
  phase: "prepare",
  kind: "action",
  title: "Elige tus proveedores",
  outcome: "Proveedores elegidos",
  dependsOn: [],
  basis: [],
  validation: "per_step",
  origin: "catalog",
  steps: [s],
});

const ctx = (s: Step, notes: string | null = "Café A: 18 euros el kilo, entrega en 2 días. Café B: 22 euros el kilo."): DraftContext => ({
  idea: "Una cafetería de especialidad en mi barrio",
  facts: [known("sector", "Hospitality/Food service")],
  answers: [{ id: "find_premises#1", mold: "find_premises", question: "¿Zona?", answer: "cerca del mercado" }],
  language: "es",
  task: task(s),
  step: s,
  notes,
});

const TABLE: RawDraft = {
  template: false,
  columns: ["Proveedor", "Precio por kilo"],
  rows: [
    { cells: ["Café A", "18 euros"], source: { kind: "notes", ref: "" } },
    { cells: ["Café B", "22 euros"], source: { kind: "notes", ref: "" } },
  ],
};

describe("reviewDraft", () => {
  it("tabla con notas: cada fila con su fuente y cifras de las notas", () => {
    const draft = reviewDraft(TABLE, ctx(step("comparison_table")));
    assert.ok(draft);
    assert.match(renderDraft(draft, "es"), /\| Café A \| 18 euros \| tus notas \|/);
  });

  it("cifra que no está en las notas ni en los datos: se rechaza", () => {
    const invented = { ...TABLE, rows: [{ cells: ["Café C", "35 euros"], source: { kind: "notes" as const, ref: "" } }] };
    assert.equal(reviewDraft(invented, ctx(step("comparison_table"))), null);
  });

  it("fuentes que no existen o filas sin fuente: se rechaza", () => {
    const badData = { ...TABLE, rows: [{ cells: ["Café A", "18 euros"], source: { kind: "data" as const, ref: "budget_eur" } }] };
    const noSource = { ...TABLE, rows: [{ cells: ["Café A", "18 euros"], source: { kind: "none" as const, ref: "" } }] };
    assert.equal(reviewDraft(badData, ctx(step("comparison_table"))), null);
    assert.equal(reviewDraft(noSource, ctx(step("comparison_table"))), null);
  });

  it("sin notas: solo plantilla vacía, sin datos ni fuentes", () => {
    const template: RawDraft = {
      template: true,
      columns: ["Proveedor", "Precio por kilo"],
      rows: [{ cells: ["Proveedor 1", ""], source: { kind: "none", ref: "" } }],
    };
    assert.ok(reviewDraft(template, ctx(step("comparison_table"), null)));
    assert.equal(reviewDraft(TABLE, ctx(step("comparison_table"), null)), null);
  });

  it("resumen con fuentes de respuesta o dato; texto y lista sin fuentes", () => {
    const summary: RawDraft = {
      template: false,
      points: [
        { text: "Quieres estar cerca del mercado", source: { kind: "answer", ref: "find_premises#1" } },
        { text: "Es un negocio de hostelería", source: { kind: "data", ref: "sector" } },
      ],
    };
    assert.ok(reviewDraft(summary, ctx(step("research_summary"))));
    assert.ok(reviewDraft({ text: "Propuesta para tu barrio" }, ctx(step("draft_text"))));
    assert.ok(reviewDraft({ items: ["Alquiler", "Fianza"] }, ctx(step("checklist"))));
  });

  it("texto y lista: contenido real, nunca huecos ni JSON", () => {
    assert.ok(reviewDraft({ text: "¿Dónde tomas café cada mañana y por qué allí?" }, ctx(step("draft_text"), null)));
    assert.equal(reviewDraft({ text: "Cliente típico: [Por completar]" }, ctx(step("draft_text"), null)), null);
    assert.equal(reviewDraft({ text: '{"template":true}' }, ctx(step("draft_text"), null)), null);
    assert.equal(reviewDraft({ items: ["Elemento: ____"] }, ctx(step("checklist"), null)), null);
  });

  it("sin notas: propuestas de la IA en tablas y resúmenes, no plantilla obligatoria", () => {
    const options: RawDraft = {
      template: false,
      columns: ["Prueba", "Qué cuenta como compromiso"],
      rows: [
        { cells: ["Preventa", "Pagar por adelantado"], source: { kind: "suggestion", ref: "" } },
        { cells: ["Piloto", "Firmar la participación"], source: { kind: "suggestion", ref: "" } },
      ],
    };
    assert.ok(reviewDraft(options, ctx(step("comparison_table"), null)));
    const summary: RawDraft = { template: false, points: [{ text: "Empieza por tu barrio", source: { kind: "suggestion", ref: "" } }] };
    assert.ok(reviewDraft(summary, ctx(step("research_summary"), null)));
  });

  it("con notas no se admite plantilla vacía", () => {
    const template: RawDraft = {
      template: true,
      columns: ["Proveedor", "Precio por kilo"],
      rows: [{ cells: ["Proveedor 1", ""], source: { kind: "none", ref: "" } }],
    };
    assert.equal(reviewDraft(template, ctx(step("comparison_table"))), null);
  });

  it("el esquema de cada capacidad tiene sus campos", () => {
    const table = draftFormat("comparison_table").schema as { required: string[] };
    assert.deepEqual(table.required, ["template", "columns", "rows"]);
  });
});

describe("stepDraft, editar y validar", () => {
  const gptReturning = (responses: unknown[]) => {
    const calls: GptRequest<unknown>[] = [];
    const gpt = async <T>(request: GptRequest<T>) => {
      calls.push(request as GptRequest<unknown>);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return { data: request.parse.parse(next) };
    };
    return { gpt, calls };
  };

  it("genera el borrador: paso en 'borrador de la IA', con tus notas guardadas", async () => {
    const out = await stepDraft(gptReturning([TABLE]).gpt, ctx(step("comparison_table")));
    assert.equal(out.status, "draft");
    if (out.status !== "draft") return;
    assert.equal(out.step.status, "ai_draft");
    assert.ok(readDraft(out.step));
    assert.ok(out.step.note?.includes("Café A"));
  });

  it("si falla la revisión dos veces, el paso se queda como estaba", async () => {
    const invented = { ...TABLE, rows: [{ cells: ["X", "99 euros"], source: { kind: "notes", ref: "" } }] };
    const { gpt, calls } = gptReturning([invented, invented]);
    assert.deepEqual(await stepDraft(gpt, ctx(step("comparison_table"))), { status: "kept", reason: "numbers" });
    assert.equal(calls.length, 2);
  });

  it("solo en pasos de la IA sin validar", async () => {
    assert.equal(canDraft(step("draft_text", { status: "done", artifact: "x" })), false);
    assert.equal(canDraft(step(undefined, { actor: "user", allowedActors: ["user"], suggestedActor: "user" })), false);
    const { gpt } = gptReturning([]);
    assert.deepEqual(await stepDraft(gpt, ctx(step("draft_text", { status: "done", artifact: "x" }))), { status: "not_allowed" });
  });

  it("editar mantiene el borrador; validar lo da por hecho", async () => {
    const out = await stepDraft(gptReturning([{ text: "Borrador" }]).gpt, ctx(step("draft_text")));
    assert.equal(out.status, "draft");
    if (out.status !== "draft") return;
    const edited = editDraft(out.step, { capability: "draft_text", text: "Mi versión con 300 euros" });
    assert.ok(edited);
    assert.equal(edited.status, "ai_draft");
    assert.equal(editDraft(out.step, { capability: "checklist", items: ["x"] }), null);
    assert.equal(validateDraft(edited)?.status, "done");
    assert.equal(validateDraft(step("draft_text")), null);
  });
});