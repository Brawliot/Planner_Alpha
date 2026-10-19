/**
 * Calibración de Jev como juez del plan (especificidad) contra casos etiquetados.
 * Llama a la API real: se ejecuta a mano.
 *
 *   npm run calibrate:plan
 *
 * Propone SPECIFIC_MIN_NOUL para src/lib/plan/judge.ts. Los tramos y la complejidad se descartaron
 * tras calibrarlos (ver el comentario de judge.ts).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { callJev } from "../src/lib/jev.ts";
import { judgeState, specificityQuestions, type DraftTask } from "../src/lib/plan/judge.ts";
import { minScoreFor, summarize } from "./calibration/metrics.ts";
import { SPECIFIC_CASES, type SpecificLabel } from "./calibration/plan-cases.ts";

const TARGET_PRECISION = 1;
const RUNS = 3;
const CONCURRENCY = 4;

interface NoulRun {
  id: string;
  lang: string;
  label: SpecificLabel;
  run: number;
  noul: number | null;
}

let failures = 0;
const models = new Set<string>();

async function pool<T>(tasks: Array<() => Promise<T>>, limit: number) {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function runNoul(c: (typeof SPECIFIC_CASES)[number], run: number): Promise<NoulRun> {
  const draft: DraftTask = {
    id: "t1",
    title: c.title,
    outcome: c.title,
    steps: c.steps.map((text, index) => ({ id: `s${index + 1}`, text })),
  };
  const row = { id: c.id, lang: c.lang, label: c.label, run };
  try {
    const result = await callJev(judgeState(c.business, [], { tasks: [draft] }), specificityQuestions([draft]));
    models.add(result.model);
    const answer = result.answers["specific.t1"];
    return { ...row, noul: answer?.type === "noul" ? answer.noul : null };
  } catch {
    failures++;
    return { ...row, noul: null };
  }
}

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)} %`;

async function main() {
  const tasks = SPECIFIC_CASES.flatMap((c) => Array.from({ length: RUNS }, (_, run) => () => runNoul(c, run)));
  console.log(`Ejecutando ${tasks.length} llamadas a Jev...`);
  const runs = await pool(tasks, CONCURRENCY);

  console.log("\n== Especificidad (noul) ==");
  const first = runs.filter((r) => r.run === 0 && r.noul !== null);
  for (const label of ["specific", "generic"] as const) {
    console.log(label.padEnd(10), summarize(first.filter((r) => r.label === label).map((r) => r.noul as number)));
  }
  const specificMin = minScoreFor(
    first.map((r) => ({ score: r.noul as number, correct: r.label === "specific" })),
    TARGET_PRECISION,
  );
  console.log(
    specificMin
      ? `SPECIFIC_MIN_NOUL ≈ ${specificMin.threshold.toFixed(3)} (acierto ${pct(specificMin.precision)}, cubre ${pct(specificMin.coverage)})`
      : "Ningún umbral separa lo específico de lo genérico con el acierto exigido.",
  );
  const genericMax = Math.max(...first.filter((r) => r.label === "generic").map((r) => r.noul as number));
  if (specificMin && genericMax >= specificMin.threshold) console.log("AVISO: alguna genérica pasa el umbral.");

  console.log(`\nModelo(s): ${[...models].join(", ") || "ninguno respondió"} · llamadas fallidas: ${failures}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir("docs/calibration", { recursive: true });
  const file = `docs/calibration/plan-${stamp}.json`;
  await writeFile(file, JSON.stringify({ date: new Date().toISOString(), models: [...models], failures, specificMin, runs }, null, 2));
  console.log(`Detalle guardado en ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});