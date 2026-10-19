import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig, type PlanConfig } from "../../src/lib/plan/config.ts";
import type { Mold, MoldStep } from "../../src/lib/plan/mold.ts";
import { rebuildPlan, type StoredPlan } from "../../src/lib/plan/orchestrator.ts";
import type { StateId } from "../../src/lib/plan/states.ts";
import type { Task } from "../../src/lib/plan/task.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import type { AreaVerdict } from "../../src/lib/report/verdict.ts";

const user = (key: string, value: unknown): Fact => ({ key, value, source: { origin: "user", quote: "x" } });
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

const register = mold("register", ["legal_entity_ready"], {
  department: "legal",
  steps: [
    step("s", {
      suggestedActor: "third_party",
      options: { third_party: { effort: "under_1h", wait: "under_1w", cost: "500_2000", thirdParty: "advisor" } },
    }),
  ],
});
const sell = mold("sell", ["first_customers"], { department: "sales", needs: ["legal_entity_ready"] });
const cost = mold("cost", [], { department: "finance", unlocks: ["startup_cost_eur"] });
const loan = mold("loan", ["funding_covered"], { department: "finance", needs: ["fact:startup_cost_eur"] });
const CATALOG = [register, sell, cost, loan];

const shortMoney: AreaVerdict = { area: "money", verdict: "risk", reason: "money.short", missing: [], gaps: [], estimated: false };
const config = (changes: Partial<PlanConfig> = {}): PlanConfig => ({
  ...defaultConfig("2026-10-19", { min: 10, max: 20 }),
  launchLevel: 1,
  ...changes,
});

const rebuild = (options: { facts?: Fact[]; stored?: StoredPlan | null; config?: PlanConfig; fingerprint?: string } = {}) =>
  rebuildPlan({
    report: { facts: options.facts ?? [], verdicts: [shortMoney], language: "es", fingerprint: options.fingerprint ?? "f1" },
    config: options.config ?? config(),
    catalog: CATALOG,
    stored: options.stored ?? null,
    today: "2026-10-19",
  });

const store = (plan: ReturnType<typeof rebuild>, tasks: Task[] = plan.tasks): StoredPlan => ({
  lines: plan.lines,
  tasks,
  dismissed: plan.dismissed,
  fingerprint: plan.fingerprint,
});
const finish = (task: Task): Task => ({ ...task, steps: task.steps.map((s) => ({ ...s, status: "done" as const })) });

describe("rebuildPlan", () => {
  it("primer cálculo: plan completo, con fechas y sin problemas", () => {
    const plan = rebuild();
    assert.deepEqual(new Set(plan.tasks.map((t) => t.id)), new Set(["cost", "loan", "register", "sell"]));
    assert.equal(plan.timeline.tasks.length, 4);
    assert.equal(plan.reportChanged, false);
    assert.deepEqual(plan.issues, []);
  });

  it("lo terminado se queda como hecho aunque ya no haga falta, con su línea", () => {
    const first = rebuild();
    const tasks = first.tasks.map((t) => (t.id === "cost" ? finish(t) : t));
    // Terminar "cost" llevó el dato al informe: ahora es verdad y el decisor ya no pide la tarea.
    const plan = rebuild({ facts: [user("startup_cost_eur", { min: 12000, max: 16000 })], stored: store(first, tasks) });
    const done = plan.tasks.find((t) => t.id === "cost")!;
    assert.equal(done.archived, undefined);
    assert.ok(done.steps.every((s) => s.status === "done"));
    assert.ok(plan.lines.some((l) => l.id === done.lineId));
    assert.ok(!plan.timeline.tasks.some((t) => t.taskId === "cost"));
    assert.deepEqual(plan.issues, []);
  });

  it("avisa si el informe cambió desde el último cálculo", () => {
    const first = rebuild({ fingerprint: "f1" });
    assert.equal(rebuild({ stored: store(first), fingerprint: "f1" }).reportChanged, false);
    const plan = rebuild({ stored: store(first), fingerprint: "f2" });
    assert.equal(plan.reportChanged, true);
    assert.equal(plan.fingerprint, "f2");
  });

  it("fecha límite: sin ella no hay aviso; con una lejana, a tiempo", () => {
    assert.equal(rebuild().deadline, null);
    assert.equal(rebuild({ config: config({ deadline: "2027-12-31" }) }).deadline, "on_track");
  });
});

describe("aviso de dinero", () => {
  const startup = user("startup_cost_eur", { min: 12000, max: 16000 });
  // El plan cuesta 500–2000 € (el gestor del alta).
  const withBudget = (amount: number) => rebuild({ facts: [startup, user("budget_eur", amount)] }).money;

  it("compara el coste del plan con lo que queda tras el arranque", () => {
    const money = withBudget(20000);
    assert.deepEqual(money.cost, { min: 500, max: 2000 });
    assert.deepEqual(money.available, { min: 4000, max: 8000 });
    assert.equal(money.status, "fits");
  });

  it("solo llega en el mejor caso: en riesgo; en ninguno: no llega", () => {
    assert.equal(withBudget(16500).status, "at_risk");
    assert.equal(withBudget(12000).status, "over");
  });

  it("sin coste de arranque o sin presupuesto no hay aviso, pero sí coste", () => {
    const money = rebuild().money;
    assert.equal(money.status, null);
    assert.equal(money.available, null);
    assert.deepEqual(money.cost, { min: 500, max: 2000 });
  });
});