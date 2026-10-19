import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig, type PlanConfig } from "../../src/lib/plan/config.ts";
import { buildSkeleton } from "../../src/lib/plan/engine.ts";
import { lineIssues, lineSchema } from "../../src/lib/plan/line.ts";
import type { Mold, MoldStep } from "../../src/lib/plan/mold.ts";
import type { StateId } from "../../src/lib/plan/states.ts";
import { taskSchema } from "../../src/lib/plan/task.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import type { AreaVerdict } from "../../src/lib/report/verdict.ts";
import { option } from "../../src/lib/report/verdict.ts";

const known = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});
const estimated = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: CALIBRATED_JEV_MODEL } },
});

const text = (s: string) => ({ en: s, es: s });
const step = (id: string, extra: Partial<MoldStep> = {}): MoldStep => ({
  id,
  text: text(id),
  doneWhen: text(id),
  suggestedActor: "user",
  options: { user: { effort: "1_4h" } },
  ...extra,
});
const mold = (id: string, gets: StateId[], extra: Partial<Mold> = {}): Mold => ({
  id,
  department: "product",
  phase: "prepare",
  kind: "action",
  title: text(id),
  outcome: text(id),
  needs: [],
  gets,
  steps: [step("s")],
  ...extra,
});
const red = (area: AreaVerdict["area"], reason: string): AreaVerdict => ({
  area,
  verdict: "risk",
  reason,
  missing: [],
  gaps: [],
  estimated: false,
});
const config = (changes: Partial<PlanConfig> = {}): PlanConfig => ({
  ...defaultConfig("2026-10-19", { min: 10, max: 20 }),
  launchLevel: 1,
  ...changes,
});

// Lanzamiento de nivel 1 sin datos: primeros clientes y alta.
const register = mold("register", ["legal_entity_ready"], { department: "legal" });
const sell = mold("sell", ["first_customers"], { department: "sales", needs: ["legal_entity_ready"], phase: "launch" });
const cost = mold("cost", [], { department: "finance", unlocks: "startup_cost_eur", phase: "validate" });
const loan = mold("loan", ["funding_covered"], { department: "finance", needs: ["fact:startup_cost_eur"] });
const cut = mold("cut", ["funding_covered"], {
  department: "finance",
  steps: [step("s", { options: { user: { effort: "1_3d" } } })],
  fit: [{ when: { employed: true }, reason: text("keeps job") }],
});
const BASE = [register, sell];

const build = (catalog: Mold[], options: { facts?: Fact[]; verdicts?: AreaVerdict[]; config?: PlanConfig } = {}) =>
  buildSkeleton({
    facts: options.facts ?? [],
    verdicts: options.verdicts ?? [],
    config: options.config ?? config(),
    catalog,
    achieved: [],
    language: "es",
  });

const ids = (skeleton: ReturnType<typeof build>) => skeleton.tasks.map((task) => task.id);
const taskOf = (skeleton: ReturnType<typeof build>, id: string) => skeleton.tasks.find((task) => task.id === id)!;

describe("buildSkeleton: encadenado", () => {
  it("de un rojo y la meta de lanzamiento a tareas ordenadas con sus dependencias", () => {
    const plan = build([...BASE, cost, loan], { verdicts: [red("money", "money.short")] });
    assert.deepEqual(plan.issues, []);
    assert.deepEqual(new Set(ids(plan)), new Set(["cost", "loan", "register", "sell"]));
    assert.deepEqual(taskOf(plan, "loan").dependsOn, ["cost"]);
    assert.deepEqual(taskOf(plan, "sell").dependsOn, ["register"]);
    assert.ok(ids(plan).indexOf("cost") < ids(plan).indexOf("loan"));
    assert.ok(ids(plan).indexOf("register") < ids(plan).indexOf("sell"));

    assert.equal(taskOf(plan, "cost").lineId, "risk:money");
    assert.equal(taskOf(plan, "register").lineId, "base:legal");
    // Las líneas base siguen el orden fijo de DEPARTMENTS (ventas antes que legal).
    assert.deepEqual(plan.lines.map((l) => l.id), ["risk:money", "base:sales", "base:legal"]);
    assert.equal(plan.lines[0].department, "finance");
    assert.equal(plan.lines[0].goal, "Financiación cubierta");
  });

  it("lo que ya es verdad no genera tareas ni dependencias", () => {
    const plan = build(BASE, { config: config({ done: ["legal_entity"] }) });
    assert.deepEqual(ids(plan), ["sell"]);
    assert.deepEqual(taskOf(plan, "sell").dependsOn, []);
    assert.deepEqual(plan.lines.map((l) => l.id), ["base:sales"]);
  });

  it("un molde que piden dos líneas entra una vez, en la más prioritaria", () => {
    const differ = mold("differ", ["differentiator_defined"]);
    const map = mold("map", ["competitors_mapped"], { department: "sales" });
    const plan = build([...BASE, differ, map], {
      verdicts: [red("concept", "concept.no_differentiator"), red("competition", "competition.crowded")],
    });
    assert.equal(ids(plan).filter((id) => id === "differ").length, 1);
    assert.equal(taskOf(plan, "differ").lineId, "risk:concept");
    assert.equal(taskOf(plan, "map").lineId, "risk:competition");
  });

  it("abrir es lo último: los primeros clientes esperan a todo lo que pide el lanzamiento", () => {
    const premises = mold("premises", ["premises_ready"], { department: "operations" });
    const supply = mold("supply", ["suppliers_chosen"], { department: "operations" });
    const plan = build([...BASE, premises, supply], { facts: [known("offering_type", "Physical venue")] });
    assert.deepEqual(plan.issues, []);
    assert.deepEqual(new Set(taskOf(plan, "sell").dependsOn), new Set(["register", "premises", "supply"]));
  });

  it("un requisito de otro departamento va a su línea base; del mismo, se queda", () => {
    const identify = mold("identify", ["licenses_identified"], { department: "legal" });
    const licenses = mold("licenses", ["licenses_granted"], {
      department: "legal",
      needs: ["premises_signed", "legal_entity_ready"],
    });
    const sign = mold("sign", ["premises_signed"], { department: "operations" });
    const plan = build([...BASE, identify, licenses, sign], { verdicts: [red("regulation", "regulation.heavy")] });
    assert.equal(taskOf(plan, "licenses").lineId, "risk:regulation");
    assert.equal(taskOf(plan, "register").lineId, "risk:regulation");
    assert.equal(taskOf(plan, "sign").lineId, "base:operations");
  });

  it("lo que una línea del informe pide directamente no se queda en la base", () => {
    // El coste de arranque es de otro departamento: como requisito del préstamo iría a la base,
    // pero la línea "por concretar" de Dinero lo pide directamente.
    const research = mold("cost", [], { department: "operations", unlocks: "startup_cost_eur" });
    const plan = build([...BASE, research, loan], {
      verdicts: [{ ...red("money", "money.short"), gaps: ["startup_cost_eur"] }],
    });
    assert.equal(taskOf(plan, "cost").lineId, "gaps:money");
    assert.ok(plan.lines.some((line) => line.id === "gaps:money"));
  });

  it("los estimados generan una línea para confirmarlos", () => {
    const research = mold("research", [], { unlocks: "competition", department: "sales" });
    const plan = build([...BASE, research], { facts: [estimated("competition", "Crowded market")] });
    assert.equal(taskOf(plan, "research").lineId, "estimated:competition");
  });
});

describe("buildSkeleton: elegir camino", () => {
  const money = { verdicts: [red("money", "money.short")] };

  it("gana el que mejor encaja con tu situación, sin decisión", () => {
    const plan = build([...BASE, cost, loan, cut], { ...money, config: config({ employed: true }) });
    assert.ok(ids(plan).includes("cut"));
    assert.ok(!ids(plan).includes("loan"));
    assert.deepEqual(plan.decisions, []);
  });

  it("empate: tarea de decisión y camino provisional, el más barato en horas", () => {
    const plan = build([...BASE, cost, loan, cut], money);
    assert.deepEqual(plan.decisions, [
      { state: "funding_covered", options: ["loan", "cut"], chosen: "loan", taskId: "decide:funding_covered" },
    ]);
    const decide = taskOf(plan, "decide:funding_covered");
    assert.equal(decide.kind, "decision");
    assert.equal(decide.lineId, "risk:money");
    assert.ok(taskOf(plan, "loan").dependsOn.includes("decide:funding_covered"));
  });

  it("tu elección manda y no hay decisión", () => {
    const plan = build([...BASE, cost, loan, cut], { ...money, config: config({ levers: { funding_covered: "cut" } }) });
    assert.ok(ids(plan).includes("cut"));
    assert.deepEqual(plan.decisions, []);
  });

  it("lo específico gana a lo genérico", () => {
    const generic = mold("generic", ["dependency_mitigated"]);
    const specific = mold("specific", ["dependency_mitigated"], {
      when: { facts: [{ key: "offering_type", anyOf: [option("offering_type", "Software")] }] },
    });
    const mvp = mold("mvp", ["mvp_ready"]);
    const plan = build([...BASE, generic, specific, mvp], {
      facts: [known("offering_type", "Software")],
      verdicts: [red("dependencies", "dependencies.platform")],
    });
    assert.ok(ids(plan).includes("specific"));
    assert.ok(!ids(plan).includes("generic"));
    assert.deepEqual(taskOf(plan, "specific").basis, ["offering_type"]);
  });
});

describe("buildSkeleton: tareas y problemas", () => {
  it("los pasos usan tu reparto: con IA, la IA y sus cifras", () => {
    const draft = mold("draft", ["legal_entity_ready"], {
      steps: [step("s", { options: { user: { effort: "4_8h" }, ai: { effort: "under_1h", capability: "draft_text" } } })],
    });
    const plan = build([draft, sell], { config: config({ delegation: ["ai"] }) });
    const [s] = taskOf(plan, "draft").steps;
    assert.equal(s.actor, "ai");
    assert.equal(s.aiCapability, "draft_text");
    assert.deepEqual(s.effort, { min: 0.25, max: 1 });
  });

  it("todo lo generado cumple los esquemas y no tiene problemas de grafo", () => {
    const plan = build([...BASE, cost, loan, cut], { verdicts: [red("money", "money.short")] });
    for (const task of plan.tasks) taskSchema.parse(task);
    for (const line of plan.lines) lineSchema.parse(line);
    assert.deepEqual(lineIssues(plan.lines, plan.tasks), []);
    assert.deepEqual(plan.issues, []);
  });

  it("lo inalcanzable no falla en silencio", () => {
    const plan = build([], { verdicts: [red("team", "team.demanding")] });
    assert.ok(plan.issues.includes("unreachable roles_defined"));
    assert.ok(plan.issues.includes("unreachable first_customers"));
    assert.deepEqual(plan.tasks, []);
  });

  it("un problema que piden dos líneas aparece una sola vez", () => {
    const gap = (area: AreaVerdict["area"]): AreaVerdict => ({
      area,
      verdict: "strong",
      reason: `${area}.strong`,
      missing: [],
      gaps: ["geographic_scope"],
      estimated: false,
    });
    const plan = build(BASE, { verdicts: [gap("market"), gap("location")] });
    assert.equal(plan.issues.filter((issue) => issue === "unreachable fact:geographic_scope").length, 1);
  });

  it("un rojo sin objetivo aparece en issues", () => {
    const plan = build(BASE, { verdicts: [red("concept", "concept.invented")] });
    assert.ok(plan.issues.includes("no goal for risk:concept"));
  });
});