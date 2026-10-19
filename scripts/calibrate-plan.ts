/**
 * Calibración de Jev como juez del plan contra casos etiquetados: especificidad de las tareas
 * generadas y calidad de las preguntas previas. Llama a la API real: se ejecuta a mano.
 *
 *   npm run calibrate:plan
 *
 * Propone SPECIFIC_MIN_NOUL y QUESTION_MIN_NOUL para src/lib/plan/judge.ts. Los tramos y la
 * complejidad se descartaron tras calibrarlos (ver el comentario de judge.ts).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { callJev, type JevQuestion, type JevState } from "../src/lib/jev.ts";
import { judgeState, questionQualityQuestions, specificityQuestions, type DraftTask } from "../src/lib/plan/judge.ts";
import { minScoreFor, summarize } from "./calibration/metrics.ts";
import { QUESTION_CASES, SPECIFIC_CASES } from "./calibration/plan-cases.ts";

const TARGET_PRECISION = 1;
const RUNS = 3;
const CONCURRENCY = 4;

interface NoulItem {
  set: "specific" | "question";
  id: string;
  lang: string;
  /** La etiqueta "positiva" (específica o buena) es la que debe superar el umbral. */
  positive: boolean;
  state: JevState;
  question: JevQuestion;
  key: string;
}

interface NoulRun {
  set: NoulItem["set"];
  id: string;
  lang: string;
  positive: boolean;
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

function items(): NoulItem[] {
  const specific = SPECIFIC_CASES.map((c): NoulItem => {
    const draft: DraftTask = {
      id: "t1",
      title: c.title,
      outcome: c.title,
      steps: c.steps.map((text, index) => ({ id: `s${index + 1}`, text })),
    };
    return {
      set: "specific",
      id: c.id,
      lang: c.lang,
      positive: c.label === "specific",
      state: judgeState(c.business, [], { tasks: [draft] }),
      question: specificityQuestions([draft])["specific.t1"],
      key: "specific.t1",
    };
  });
  const questions = QUESTION_CASES.map((c): NoulItem => {
    const proposed = { id: "a1", text: c.text, options: c.options };
    return {
      set: "question",
      id: c.id,
      lang: c.lang,
      positive: c.label === "good",
      state: judgeState(c.business, [], { questions: [proposed], other_tasks: c.otherTasks, previous_answers: c.previous }),
      question: questionQualityQuestions([proposed])["question.a1"],
      key: "question.a1",
    };
  });
  return [...specific, ...questions];
}

async function runNoul(item: NoulItem, run: number): Promise<NoulRun> {
  const row = { set: item.set, id: item.id, lang: item.lang, positive: item.positive, run };
  try {
    const result = await callJev(item.state, { [item.key]: item.question });
    models.add(result.model);
    const answer = result.answers[item.key];
    return { ...row, noul: answer?.type === "noul" ? answer.noul : null };
  } catch {
    failures++;
    return { ...row, noul: null };
  }
}

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)} %`;

function report(runs: NoulRun[], set: NoulItem["set"], name: string, labels: [string, string]) {
  const first = runs.filter((r) => r.set === set && r.run === 0 && r.noul !== null);
  console.log(`\n== ${set === "specific" ? "Especificidad" : "Calidad de las preguntas"} (noul) ==`);
  console.log(labels[0].padEnd(10), summarize(first.filter((r) => r.positive).map((r) => r.noul as number)));
  console.log(labels[1].padEnd(10), summarize(first.filter((r) => !r.positive).map((r) => r.noul as number)));
  const found = minScoreFor(
    first.map((r) => ({ score: r.noul as number, correct: r.positive })),
    TARGET_PRECISION,
  );
  console.log(
    found
      ? `${name} ≈ ${found.threshold.toFixed(3)} (acierto ${pct(found.precision)}, cubre ${pct(found.coverage)})`
      : `${name}: ningún umbral separa con el acierto exigido.`,
  );
  const negatives = first.filter((r) => !r.positive);
  console.table(
    negatives
      .filter((r) => found && (r.noul as number) >= found.threshold * 0.8)
      .map((r) => ({ id: r.id, lang: r.lang, noul: r.noul })),
  );
  return found;
}

async function main() {
  const tasks = items().flatMap((item) => Array.from({ length: RUNS }, (_, run) => () => runNoul(item, run)));
  console.log(`Ejecutando ${tasks.length} llamadas a Jev...`);
  const runs = await pool(tasks, CONCURRENCY);

  const specificMin = report(runs, "specific", "SPECIFIC_MIN_NOUL", ["specific", "generic"]);
  const questionMin = report(runs, "question", "QUESTION_MIN_NOUL", ["good", "bad"]);
  console.log("(Las tablas muestran los casos negativos que quedan cerca del umbral.)");

  console.log(`\nModelo(s): ${[...models].join(", ") || "ninguno respondió"} · llamadas fallidas: ${failures}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir("docs/calibration", { recursive: true });
  const file = `docs/calibration/plan-${stamp}.json`;
  await writeFile(
    file,
    JSON.stringify({ date: new Date().toISOString(), models: [...models], failures, specificMin, questionMin, runs }, null, 2),
  );
  console.log(`Detalle guardado en ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});