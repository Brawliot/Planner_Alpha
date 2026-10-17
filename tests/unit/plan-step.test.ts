import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransition, stepSchema, type Step } from "../../src/lib/plan/step.ts";

const THIRD: Step = {
  id: "self_employed.submit",
  order: 3,
  text: "Presentar el alta",
  doneWhen: "Tienes el justificante",
  suggestedActor: "third_party",
  allowedActors: ["user", "third_party"],
  actor: "third_party",
  effort: { min: 0.25, max: 0.5 },
  thirdParty: "advisor",
  wait: { min: 3, max: 7 },
  cost: { min: 50, max: 150 },
  status: "requested",
};

const AI: Step = {
  id: "self_employed.checklist",
  order: 1,
  text: "Checklist de documentos",
  doneWhen: "Checklist revisada",
  suggestedActor: "ai",
  allowedActors: ["ai", "user"],
  actor: "ai",
  effort: { min: 0.5, max: 0.5 },
  aiCapability: "checklist",
  status: "todo",
};

const valid = (step: unknown) => stepSchema.safeParse(step).success;

describe("stepSchema", () => {
  it("acepta pasos válidos de tercero y de IA", () => {
    assert.ok(valid(THIRD));
    assert.ok(valid(AI));
  });

  it("rechaza un actor fuera de allowedActors", () => {
    assert.ok(!valid({ ...AI, actor: "third_party", thirdParty: "advisor", wait: { min: 1, max: 2 }, aiCapability: undefined }));
  });

  it("exige thirdParty y wait solo con third_party", () => {
    assert.ok(!valid({ ...THIRD, wait: undefined }));
    assert.ok(!valid({ ...THIRD, actor: "user", status: "todo" }));
  });

  it("exige aiCapability solo con ai", () => {
    assert.ok(!valid({ ...AI, aiCapability: undefined }));
  });

  it("rechaza un estado que no corresponde al actor", () => {
    assert.ok(!valid({ ...AI, status: "requested" }));
  });

  it("rechaza rangos invertidos o negativos", () => {
    assert.ok(!valid({ ...AI, effort: { min: 2, max: 1 } }));
    assert.ok(!valid({ ...THIRD, cost: { min: -1, max: 10 } }));
  });

  it("un borrador de IA necesita contenido", () => {
    assert.ok(!valid({ ...AI, status: "ai_draft" }));
    assert.ok(valid({ ...AI, status: "ai_draft", artifact: "- DNI" }));
  });
});

describe("canTransition", () => {
  it("la IA no salta a hecho sin borrador", () => {
    assert.equal(canTransition("ai", "todo", "done"), false);
    assert.equal(canTransition("ai", "todo", "ai_draft"), true);
    assert.equal(canTransition("ai", "ai_draft", "done"), true);
  });

  it("el tercero sigue pedir → recibir → hecho", () => {
    assert.equal(canTransition("third_party", "todo", "requested"), true);
    assert.equal(canTransition("third_party", "requested", "done"), false);
    assert.equal(canTransition("third_party", "received", "done"), true);
  });

  it("estados ajenos al actor no valen", () => {
    assert.equal(canTransition("user", "todo", "requested"), false);
  });

  it("se puede reabrir desde cualquier estado, salvo desde todo", () => {
    assert.equal(canTransition("user", "done", "todo"), true);
    assert.equal(canTransition("third_party", "skipped", "todo"), true);
    assert.equal(canTransition("user", "todo", "todo"), false);
  });
});