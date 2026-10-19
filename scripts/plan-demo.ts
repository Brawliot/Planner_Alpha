/**
 * Muestra en la terminal el plan que sale de un informe de ejemplo, con el catálogo real.
 * Solo para mirar (no es un test ni parte del producto). Uso:
 *   npm run plan:demo            → cafetería de especialidad
 *   npm run plan:demo -- saas    → SaaS para gestorías
 */
import { MOLDS } from "../src/lib/plan/catalog.ts";
import type { PlanConfig } from "../src/lib/plan/config.ts";
import { activeDepartments, type Department } from "../src/lib/plan/line.ts";
import { rebuildPlan } from "../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../src/lib/plan/prefill.ts";
import type { Actor } from "../src/lib/plan/step.ts";
import type { Range, Task } from "../src/lib/plan/task.ts";
import { addDays, weeksOf } from "../src/lib/plan/timeline.ts";
import { CALIBRATED_JEV_MODEL } from "../src/lib/report/certainty.ts";
import type { Fact } from "../src/lib/report/facts.ts";
import { areaVerdicts } from "../src/lib/report/verdict.ts";

const known = (key: string, value: unknown): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});
const user = (key: string, value: unknown): Fact => ({ key, value, source: { origin: "user", quote: String(value) } });
const estimated = (key: string, value: unknown): Fact => ({
  key,
  value,
  source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: CALIBRATED_JEV_MODEL } },
});

interface Example {
  title: string;
  facts: Fact[];
  /** Lo que el informe no sabe y se pregunta en la configuración. */
  config: Partial<PlanConfig>;
}

const EXAMPLES: Record<string, Example> = {
  cafe: {
    title: "Cafetería de especialidad (Ana)",
    facts: [
      known("sector", "Hospitality/Food service"),
      known("offering_type", "Physical venue"),
      known("revenue_model", "One-time sale"),
      known("customer_segment", "Consumers"),
      known("regulatory_load", "Heavy (health, finance, food)"),
      known("validation_stage", "Idea only"),
      known("founder_experience", "Over 5 years"),
      known("time_commitment", "Full time"),
      known("competition", "Few competitors"),
      user("budget_eur", 10000),
      estimated("startup_cost_eur", { min: 20000, max: 30000 }),
    ],
    config: { employed: false, hasNetwork: null, launchLevel: 1 },
  },
  saas: {
    title: "SaaS para gestorías",
    facts: [
      known("sector", "Technology/SaaS"),
      known("offering_type", "Software"),
      known("revenue_model", "Subscription"),
      known("customer_segment", "Small businesses (1-50)"),
      known("acquisition_channel", "Direct sales"),
      known("validation_stage", "Problem validated"),
      known("founder_experience", "2-5 years"),
      known("founder_profile", "Technical"),
      known("time_commitment", "10-20 h/week"),
      known("competition", "Crowded market"),
      known("regulatory_load", "Moderate (licenses, data protection)"),
      user("budget_eur", 15000),
      estimated("startup_cost_eur", { min: 5000, max: 12000 }),
    ],
    config: { employed: true, hasNetwork: false },
  },
};

const DEPARTMENTS: Record<Department, string> = {
  founder: "Tú",
  product: "Producto",
  sales: "Ventas",
  finance: "Finanzas",
  legal: "Legal",
  operations: "Operaciones",
  team: "Equipo",
};
const PHASES: Record<Task["phase"], string> = { validate: "Validar", prepare: "Preparar", launch: "Lanzar", operate: "Operar" };
const ACTORS: Record<Actor, string> = { user: "tú", ai: "IA", third_party: "tercero" };

const n = (value: number) => value.toLocaleString("es-ES");
const range = (r: Range, unit: string) => (r.min === r.max ? `${n(r.min)} ${unit}` : `${n(r.min)}–${n(r.max)} ${unit}`);

const name = process.argv[2] ?? "cafe";
const example = EXAMPLES[name];
if (!example) {
  console.error(`Ejemplo desconocido: ${name}. Usa: ${Object.keys(EXAMPLES).join(", ")}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const { config: prefilled } = prefillConfig(example.facts, today);
const config: PlanConfig = { ...prefilled, ...example.config };
const plan = rebuildPlan({
  report: { facts: example.facts, verdicts: areaVerdicts(example.facts), language: "es", fingerprint: "demo" },
  config,
  catalog: MOLDS,
  stored: null,
  today,
});

const schedule = new Map(plan.timeline.tasks.map((s) => [s.taskId, s]));
const titles = new Map(plan.tasks.map((t) => [t.id, t.title]));
const endWeeks = { min: Math.ceil(plan.timeline.end.min / 7), max: Math.ceil(plan.timeline.end.max / 7) };

console.log(`\n=== ${example.title} ===`);
console.log(
  `Inicio ${config.startDate} · ${range(config.weeklyHours, "h/semana")} · validación ${config.validationLevel} · lanzamiento ${config.launchLevel}`,
);
console.log(
  `Fin estimado: semana ${range(endWeeks, "")}(${addDays(config.startDate, plan.timeline.end.min)} – ${addDays(config.startDate, plan.timeline.end.max)})`,
);
if (plan.opening) {
  const weeks = { min: Math.ceil(plan.opening.min / 7), max: Math.ceil(plan.opening.max / 7) };
  console.log(
    `Abres: semana ${range(weeks, "")}(${addDays(config.startDate, plan.opening.min)} – ${addDays(config.startDate, plan.opening.max)})`,
  );
}
if (config.deadline) console.log(`Fecha límite ${config.deadline} (comparada con la apertura): ${plan.deadline}`);
const money = plan.money;
console.log(
  `Coste del plan: ${range(money.cost, "€")}` +
    (money.available ? ` · te queda tras arrancar: ${range(money.available, "€")} · ${money.status}` : " · sin aviso (falta presupuesto o arranque)"),
);

if (plan.decisions.length > 0) {
  console.log("\nDecisiones pendientes:");
  for (const d of plan.decisions) console.log(`  · ${titles.get(d.taskId)}: ${d.options.join(" / ")} (provisional: ${d.chosen})`);
}

for (const department of activeDepartments(plan.lines)) {
  console.log(`\n## ${DEPARTMENTS[department]}`);
  for (const line of plan.lines.filter((l) => l.department === department)) {
    console.log(`  Línea ${line.id} — objetivo: ${line.goal}`);
    for (const task of plan.tasks.filter((t) => t.lineId === line.id)) {
      const s = schedule.get(task.id);
      const when = s
        ? (() => {
            const w = weeksOf(s);
            return `semana ${w.from}–${w.to} (${addDays(config.startDate, (w.from - 1) * 7)} – ${addDays(config.startDate, w.to * 7 - 1)})`;
          })()
        : "fuera del timeline";
      const deps = task.dependsOn.length > 0 ? ` ← después de: ${task.dependsOn.map((id) => titles.get(id) ?? id).join(", ")}` : "";
      console.log(`    [${PHASES[task.phase]}] ${task.title} · ${when}${deps}`);
      for (const step of task.steps) {
        const figures = [
          range(step.effort, "h"),
          step.wait ? `espera ${range(step.wait, "días")}` : null,
          step.cost ? range(step.cost, "€") : null,
        ].filter(Boolean);
        console.log(`        - ${step.text} (${ACTORS[step.actor]}${step.thirdParty ? `: ${step.thirdParty}` : ""}; ${figures.join("; ")})`);
      }
    }
  }
}

if (plan.issues.length > 0) {
  console.log("\nPara el log (estados que aún no cubre el catálogo):");
  for (const issue of plan.issues) console.log(`  ${issue}`);
}
console.log("");