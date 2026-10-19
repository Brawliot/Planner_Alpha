import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultConfig,
  effectivePhase,
  planConfigSchema,
  resolveActor,
  type ActorChoiceInput,
  type PlanConfig,
} from "../../src/lib/plan/config.ts";
import type { Task } from "../../src/lib/plan/task.ts";

const base = defaultConfig("2026-11-02", { min: 10, max: 20 });
const config = (extra: Partial<PlanConfig>): PlanConfig => ({ ...base, ...extra });

const logo: ActorChoiceInput = {
  allowedActors: ["user", "ai", "third_party"],
  suggestedActor: "third_party",
  skill: "design",
  professional: "designer",
};
const filing: ActorChoiceInput = { allowedActors: ["user", "third_party"], suggestedActor: "third_party", professional: "advisor" };
const notary: ActorChoiceInput = { allowedActors: ["third_party"], suggestedActor: "third_party" };
const webText: ActorChoiceInput = { allowedActors: ["user", "ai"], suggestedActor: "user" };

function task(extra: Partial<Task>): Task {
  return {
    id: "t",
    lineId: "money.short",
    phase: "launch",
    kind: "action",
    title: "t",
    outcome: "t",
    dependsOn: [],
    basis: [],
    validation: "per_step",
    origin: "catalog",
    steps: [
      {
        id: "s",
        order: 0,
        text: "s",
        doneWhen: "s",
        suggestedActor: "user",
        allowedActors: ["user"],
        actor: "user",
        effort: { min: 1, max: 1 },
        status: "todo",
      },
    ],
    ...extra,
  };
}

describe("planConfigSchema", () => {
  it("acepta los valores por defecto", () => {
    assert.ok(planConfigSchema.safeParse(base).success);
  });

  it("rechaza fechas no ISO, periodos invertidos, horas invertidas y reparto vacío", () => {
    assert.ok(!planConfigSchema.safeParse(config({ startDate: "02/11/2026" })).success);
    assert.ok(!planConfigSchema.safeParse(config({ unavailable: [{ from: "2026-12-31", to: "2026-12-01" }] })).success);
    assert.ok(!planConfigSchema.safeParse(config({ weeklyHours: { min: 20, max: 10 } })).success);
    assert.ok(!planConfigSchema.safeParse(config({ delegation: [] })).success);
  });
});

describe("resolveActor", () => {
  const all = config({ skills: ["design"], professionals: ["advisor"], delegation: ["ai"] });

  it("ejemplo completo: sabes diseñar, tienes gestor y quieres IA", () => {
    assert.deepEqual(resolveActor(logo, all), { actor: "user", reason: "skill" });
    assert.deepEqual(resolveActor(filing, all), { actor: "third_party", reason: "professional" });
    assert.deepEqual(resolveActor(webText, all), { actor: "ai", reason: "ai_preference" });
    assert.deepEqual(resolveActor(notary, all), { actor: "third_party", reason: "only_option" });
  });

  it("tu elección a mano nunca se pisa", () => {
    assert.deepEqual(resolveActor({ ...logo, actorSetBy: "user", actor: "ai" }, all), { actor: "ai", reason: "user_choice" });
  });

  it("solo terceros, solo tú y sin preferencia", () => {
    assert.deepEqual(resolveActor(webText, config({ delegation: ["third_party"] })), { actor: "user", reason: "suggested" });
    assert.deepEqual(resolveActor(filing, config({ delegation: ["third_party"] })).reason, "third_party_preference");
    assert.deepEqual(resolveActor(filing, config({ delegation: ["self"] })), { actor: "user", reason: "self_preference" });
  });

  it("IA y terceros: la IA va antes que pagar a alguien nuevo", () => {
    assert.equal(resolveActor(logo, config({ delegation: ["ai", "third_party"] })).actor, "ai");
  });
});