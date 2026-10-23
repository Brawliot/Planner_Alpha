/**
 * Muestra en la terminal el plan que sale de un informe de ejemplo, con el catálogo real.
 * Solo para mirar (no es un test ni parte del producto). Uso:
 *   npm run plan:demo               → cafetería de especialidad
 *   npm run plan:demo -- saas       → SaaS para gestorías
 *   npm run plan:demo -- tienda     → tienda online de cerámica
 *   npm run plan:demo -- clinica    → clínica de fisioterapia
 */
import { MOLDS } from "../src/lib/plan/catalog.ts";
import type { PlanConfig } from "../src/lib/plan/config.ts";
import { activeDepartments, type Department } from "../src/lib/plan/line.ts";
import { rebuildPlan } from "../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../src/lib/plan/prefill.ts";
import type { Actor } from "../src/lib/plan/step.ts";
import type { Range, Task } from "../src/lib/plan/task.ts";
import { addDays, weeksOf } from "../src/lib/plan/timeline.ts";
import { areaVerdicts } from "../src/lib/report/verdict.ts";
import { EXAMPLES } from "./plan-examples.ts";


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
if (config.targetDate) console.log(`Fecha límite ${config.targetDate} (comparada con la apertura): ${plan.deadline}`);
if (plan.target) console.log(`Plazo del informe: ${plan.target.months.min}–${plan.target.months.max} meses · ${plan.target.fit} · causa: ${plan.target.cause}`);
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