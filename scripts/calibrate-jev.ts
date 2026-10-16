/**
 * Calibración de Jev contra casos etiquetados. Llama a la API real: se ejecuta a mano.
 *
 *   npm run calibrate:jev
 *
 * Imprime los umbrales propuestos y guarda el detalle en docs/calibration/ (ignorada por git).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { callJev, type JevQuestion, type JevState } from "../src/lib/jev.ts";
import { buildJevState } from "../src/lib/report/facts.ts";
import { VERDICT_QUESTIONS } from "../src/lib/report/verdict-questions.ts";
import {
  CHOICE_CASES,
  CHOICE_QUESTIONS,
  NOUL_CASES,
  PLAUSIBILITY_QUESTION,
  VERDICT_CASES,
  caseFacts,
  type NoulCase,
} from "./calibration/cases.ts";
import { accuracyByBand, agreement, minScoreFor, summarize, type Scored } from "./calibration/metrics.ts";
/**
 * Acierto exigido a lo que se muestre como sabido o estimado: ningún error observado.
 * Con un 95 %, el umbral propuesto podía dejar pasar fallos y los umbrales de noul parecían solaparse.
 */
const TARGET_PRECISION = 1;
const RUNS = 3;
const CONCURRENCY = 4;

interface ChoiceRun {
  id: string;
  lang: string;
  question: string;
  expected: string;
  run: number;
  reversed: boolean;
  choice: string | null;
  confidence: number | null;
}

interface NoulRun {
  id: string;
  lang: string;
  label: string;
  run: number;
  noul: number | null;
}

let failures = 0;
const models = new Set<string>();

/** Ejecuta las tareas con un máximo de llamadas simultáneas. */
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

/** Mismas opciones en orden inverso, para medir el sesgo hacia la primera opción. */
function reversedQuestion(question: Extract<JevQuestion, { type: "choice" }>) {
  return { ...question, criteria: Object.fromEntries(Object.entries(question.criteria).reverse()) };
}

/** Una pregunta choice a medir: clasificación (paso 5d) o veredicto (paso 9b). Mismo umbral para ambas. */
interface ChoiceTask {
  id: string;
  lang: string;
  question: string;
  expected: string;
  state: JevState;
  jev: Extract<JevQuestion, { type: "choice" }>;
}

function choiceTasks(): ChoiceTask[] {
  return [
    ...CHOICE_CASES.map((c) => ({
      id: c.id,
      lang: c.lang,
      question: c.question,
      expected: c.expected,
      state: buildJevState(c.text, []),
      jev: CHOICE_QUESTIONS[c.question],
    })),
    ...VERDICT_CASES.map((v) => ({
      id: v.id,
      lang: v.lang,
      question: `verdict.${v.area}`,
      expected: v.expected,
      state: buildJevState(v.idea, caseFacts(v)),
      jev: VERDICT_QUESTIONS[v.area],
    })),
  ];
}

async function runChoice(item: ChoiceTask, run: number, reversed: boolean): Promise<ChoiceRun> {
  const question = reversed ? reversedQuestion(item.jev) : item.jev;
  const row = { id: item.id, lang: item.lang, question: item.question, expected: item.expected, run, reversed };
  try {
    const result = await callJev(item.state, { q: question });
    models.add(result.model);
    return { ...row, choice: result.answers.q?.choice ?? null, confidence: result.answers.q?.confidence ?? null };
  } catch {
    failures++;
    return { ...row, choice: null, confidence: null };
  }
}

async function runNoul(item: NoulCase, run: number): Promise<NoulRun> {
  const state = buildJevState(item.idea, [
    { ...item.assumption, source: { origin: "gpt", model: "calibration", assumptions: [] } },
  ]);
  const row = { id: item.id, lang: item.lang, label: item.label, run };
  try {
    const result = await callJev(state, { q: PLAUSIBILITY_QUESTION });
    models.add(result.model);
    return { ...row, noul: result.answers.q?.noul ?? null };
  } catch {
    failures++;
    return { ...row, noul: null };
  }
}

function pct(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)} %`;
}

function choiceScored(rows: ChoiceRun[]): Scored[] {
  // Una respuesta descartada (null) cuenta como fallo con confianza 0.
  return rows.map((r) => ({ score: r.confidence ?? 0, correct: r.choice === r.expected }));
}

async function main() {
  const choiceTasksToRun = choiceTasks().flatMap((item) => [
    ...Array.from({ length: RUNS }, (_, run) => () => runChoice(item, run, false)),
    () => runChoice(item, 0, true),
  ]);
  const noulTasks = NOUL_CASES.flatMap((item) =>
    Array.from({ length: RUNS }, (_, run) => () => runNoul(item, run)),
  );

  console.log(`Ejecutando ${choiceTasksToRun.length + noulTasks.length} llamadas a Jev...`);
  const choiceRuns = await pool(choiceTasksToRun, CONCURRENCY);
  const noulRuns = await pool(noulTasks, CONCURRENCY);

  // Los umbrales se calculan con la primera ejecución en orden normal; las demás miden estabilidad.
  const firstChoice = choiceRuns.filter((r) => r.run === 0 && !r.reversed);
  const firstNoul = noulRuns.filter((r) => r.run === 0 && r.noul !== null);

  // ---- Clasificación (choice)
  const byLang = (lang: string) => {
    const rows = firstChoice.filter((r) => r.lang === lang);
    return rows.filter((r) => r.choice === r.expected).length / rows.length;
  };
  console.log("\n== Clasificación (choice) ==");
  console.log(`Acierto  en: ${pct(byLang("en"))}  es: ${pct(byLang("es"))}`);
  console.table(accuracyByBand(choiceScored(firstChoice)).map((b) => ({ ...b, accuracy: pct(b.accuracy) })));

  const known = minScoreFor(choiceScored(firstChoice), TARGET_PRECISION);
  console.log(
    known
      ? `KNOWN_MIN_CONFIDENCE ≈ ${known.threshold.toFixed(3)} (acierto ${pct(known.precision)}, cubre ${pct(known.coverage)} de los casos)`
      : `Ningún umbral de confianza llega al ${pct(TARGET_PRECISION)}: no hay que dar nada por sabido solo con Jev.`,
  );

  const failed = firstChoice.filter((r) => r.choice !== r.expected);
  if (failed.length) {
    console.log("Fallos (revisa también si la etiqueta era correcta):");
    console.table(failed.map((r) => ({ id: r.id, lang: r.lang, expected: r.expected, got: r.choice, confidence: r.confidence })));
  }

    // Acierto por pregunta: el umbral global no protege una pregunta que falla con confianza alta.
  console.log("\nPor pregunta:");
  const questionKeys = [...new Set(firstChoice.map((r) => r.question))];
  console.table(
    questionKeys.map((question) => {
      const rows = firstChoice.filter((r) => r.question === question);
      const right = rows.filter((r) => r.choice === r.expected);
      const wrong = rows.filter((r) => r.choice !== r.expected);
      return {
        question,
        n: rows.length,
        accuracy: pct(right.length / rows.length),
        "min conf. acierto": right.length ? Math.min(...right.map((r) => r.confidence ?? 0)).toFixed(2) : "—",
        "max conf. fallo": wrong.length ? Math.max(...wrong.map((r) => r.confidence ?? 0)).toFixed(2) : "—",
      };
    }),
  );
  console.log('Si "max conf. fallo" es >= 0,85 en alguna pregunta, el umbral global no la protege: hay que revisarla.');

  const groups = new Map<string, ChoiceRun[]>();
  for (const r of choiceRuns) {
    const key = `${r.id}:${r.lang}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const repeat = agreement([...groups.values()].map((rows) => rows.filter((r) => !r.reversed).map((r) => r.choice)));
  const orderFlips = [...groups.values()].filter((rows) => {
    const normal = rows.find((r) => r.run === 0 && !r.reversed);
    const reversed = rows.find((r) => r.reversed);
    return normal?.choice !== reversed?.choice;
  }).length;
  console.log(`Misma respuesta en las ${RUNS} ejecuciones: ${pct(repeat)}`);
  console.log(`Cambia al invertir el orden de las opciones: ${orderFlips} de ${groups.size} casos`);

  // ---- Plausibilidad (noul)
  console.log("\n== Plausibilidad (noul) ==");
  for (const label of ["plausible", "implausible", "borderline"]) {
    const values = firstNoul.filter((r) => r.label === label).map((r) => r.noul as number);
    console.log(label.padEnd(12), summarize(values));
  }

  const labelled = firstNoul.filter((r) => r.label !== "borderline");
  const plausible = minScoreFor(
    labelled.map((r) => ({ score: r.noul as number, correct: r.label === "plausible" })),
    TARGET_PRECISION,
  );
  const implausible = minScoreFor(
    labelled.map((r) => ({ score: 1 - (r.noul as number), correct: r.label === "implausible" })),
    TARGET_PRECISION,
  );
  const implausibleMax = implausible ? 1 - implausible.threshold : null;

  console.log(
    plausible
      ? `PLAUSIBLE_MIN_NOUL ≈ ${plausible.threshold.toFixed(3)} (acierto ${pct(plausible.precision)}, cubre ${pct(plausible.coverage)})`
      : "Ningún umbral separa lo plausible con el acierto exigido.",
  );
  console.log(
    implausibleMax !== null && implausible
      ? `IMPLAUSIBLE_MAX_NOUL ≈ ${implausibleMax.toFixed(3)} (acierto ${pct(implausible.precision)}, cubre ${pct(implausible.coverage)})`
      : "Ningún umbral separa lo absurdo con el acierto exigido.",
  );
  if (plausible && implausibleMax !== null && implausibleMax >= plausible.threshold) {
    console.log("AVISO: los umbrales se solapan; noul no separa bien estos casos.");
  }

  const noulGroups = new Map<string, Array<number | null>>();
  for (const r of noulRuns) {
    const key = `${r.id}:${r.lang}`;
    noulGroups.set(key, [...(noulGroups.get(key) ?? []), r.noul]);
  }
  const spreads = [...noulGroups.values()]
    .filter((values) => values.every((v) => v !== null))
    .map((values) => Math.max(...(values as number[])) - Math.min(...(values as number[])));
  console.log(`Variación de noul entre ejecuciones (máx − mín por caso):`, summarize(spreads));

  // ---- Resumen
  console.log(`\nModelo(s): ${[...models].join(", ") || "ninguno respondió"} · llamadas fallidas: ${failures}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir("docs/calibration", { recursive: true });
  const file = `docs/calibration/jev-${stamp}.json`;
  await writeFile(
    file,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        models: [...models],
        targetPrecision: TARGET_PRECISION,
        failures,
        proposals: { known, plausible, implausibleMax },
        choiceRuns,
        noulRuns,
      },
      null,
      2,
    ),
  );
  console.log(`Detalle guardado en ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});