/**
 * Calibración de Jev como juez del plan contra casos etiquetados. Llama a la API real: se ejecuta a mano.
 *
 *   npm run calibrate:plan
 *
 * Propone PLAN_MIN_CONFIDENCE (complejidad y tramos) y SPECIFIC_MIN_NOUL para src/lib/plan/judge.ts.
 * En los tramos cuenta como acierto el exacto o el de al lado; también informa del acierto exacto.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { callJev, type JevQuestion, type JevState } from "../src/lib/jev.ts";
import { COST_BAND_KEYS, EFFORT_BAND_KEYS, WAIT_BAND_KEYS } from "../src/lib/plan/bands.ts";
import { COMPLEXITY_QUESTION, judgeState, nearMass, reviewQuestions, type DraftTask } from "../src/lib/plan/judge.ts";
import { accuracyByBand, agreement, minScoreFor, summarize, type Scored } from "./calibration/metrics.ts";
import { BAND_CASES, COMPLEXITY_CASES, SPECIFIC_CASES, type SpecificLabel } from "./calibration/plan-cases.ts";

const TARGET_PRECISION = 1;
const RUNS = 3;
const CONCURRENCY = 4;

type ChoiceQuestion = Extract<JevQuestion, { type: "choice" }>;
type Kind = "complexity" | "effort" | "cost" | "wait";

interface ChoiceItem {
  id: string;
  lang: string;
  kind: Kind;
  expected: string;
  /** Orden de los tramos (acierto = exacto o el de al lado); null = solo el exacto. */
  order: readonly string[] | null;
  state: JevState;
  question: ChoiceQuestion;
}

interface ChoiceRun {
  id: string;
  lang: string;
  kind: Kind;
  expected: string;
  run: number;
  reversed: boolean;
  choice: string | null;
  confidence: number | null;
  /** Probabilidad del tramo elegido más sus vecinos (solo tramos). */
  mass: number | null;
  correct: boolean;
  exact: boolean;
}

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

const reversedQuestion = (q: ChoiceQuestion): ChoiceQuestion => ({
  ...q,
  criteria: Object.fromEntries(Object.entries(q.criteria).reverse()),
});

const draftOf = (title: string, steps: readonly string[], actor: DraftTask["steps"][number]["actors"][number]): DraftTask => ({
  id: "t1",
  title,
  outcome: title,
  steps: steps.map((text, index) => ({ id: `s${index + 1}`, text, actors: [actor] })),
});

function choiceItems(): ChoiceItem[] {
  const complexity = COMPLEXITY_CASES.map(
    (c): ChoiceItem => ({
      id: c.id,
      lang: c.lang,
      kind: "complexity",
      expected: c.expected,
      order: null,
      state: judgeState(c.business, [], { task: { title: c.task } }),
      question: COMPLEXITY_QUESTION,
    }),
  );
  const bands = BAND_CASES.flatMap((c): ChoiceItem[] => {
    const draft = draftOf(c.task, [c.step], c.actor);
    const questions = reviewQuestions([draft]);
    const state = judgeState(c.business, [], { tasks: [draft] });
    const item = (kind: Kind, expected: string, order: readonly string[]): ChoiceItem => ({
      id: c.id,
      lang: c.lang,
      kind,
      expected,
      order,
      state,
      question: questions[`${kind}.t1.s1.${c.actor}`] as ChoiceQuestion,
    });
    return [
      item("effort", c.effort, EFFORT_BAND_KEYS),
      item("cost", c.cost, COST_BAND_KEYS),
      ...(c.wait ? [item("wait", c.wait, WAIT_BAND_KEYS)] : []),
    ];
  });
  return [...complexity, ...bands];
}

function isCorrect(item: ChoiceItem, choice: string | null) {
  if (choice === null) return false;
  if (!item.order) return choice === item.expected;
  const got = item.order.indexOf(choice);
  return got >= 0 && Math.abs(got - item.order.indexOf(item.expected)) <= 1;
}

async function runChoice(item: ChoiceItem, run: number, reversed: boolean): Promise<ChoiceRun> {
  const row = { id: item.id, lang: item.lang, kind: item.kind, expected: item.expected, run, reversed };
  try {
    const result = await callJev(item.state, { q: reversed ? reversedQuestion(item.question) : item.question });
    models.add(result.model);
    const answer = result.answers.q;
    const choice = answer?.type === "choice" ? answer.choice : null;
    const confidence = answer?.type === "choice" ? answer.confidence : null;
    const mass = item.order ? nearMass(answer ?? null, item.order) : null;
    return { ...row, choice, confidence, mass, correct: isCorrect(item, choice), exact: choice === item.expected };
  } catch {
    failures++;
    return { ...row, choice: null, confidence: null, mass: null, correct: false, exact: false };
  }
}

async function runNoul(c: (typeof SPECIFIC_CASES)[number], run: number): Promise<NoulRun> {
  const draft = draftOf(c.title, c.steps, "user");
  const row = { id: c.id, lang: c.lang, label: c.label, run };
  try {
    const result = await callJev(judgeState(c.business, [], { tasks: [draft] }), { q: reviewQuestions([draft])["specific.t1"] });
    models.add(result.model);
    const answer = result.answers.q;
    return { ...row, noul: answer?.type === "noul" ? answer.noul : null };
  } catch {
    failures++;
    return { ...row, noul: null };
  }
}

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)} %`;

async function main() {
  const items = choiceItems();
  const choiceTasks = items.flatMap((item) => [
    ...Array.from({ length: RUNS }, (_, run) => () => runChoice(item, run, false)),
    () => runChoice(item, 0, true),
  ]);
  const noulTasks = SPECIFIC_CASES.flatMap((c) => Array.from({ length: RUNS }, (_, run) => () => runNoul(c, run)));

  console.log(`Ejecutando ${choiceTasks.length + noulTasks.length} llamadas a Jev...`);
  const choiceRuns = await pool(choiceTasks, CONCURRENCY);
  const noulRuns = await pool(noulTasks, CONCURRENCY);

  // ---- Complejidad y tramos (choice)
  const first = choiceRuns.filter((r) => r.run === 0 && !r.reversed);
  const scored: Scored[] = first.map((r) => ({ score: r.confidence ?? 0, correct: r.correct }));
  console.log("\n== Complejidad y tramos (choice) ==");
  console.table(accuracyByBand(scored).map((b) => ({ ...b, accuracy: pct(b.accuracy) })));
  console.table(
    (["complexity", "effort", "cost", "wait"] as const).map((kind) => {
      const rows = first.filter((r) => r.kind === kind);
      const wrong = rows.filter((r) => !r.correct);
      return {
        kind,
        n: rows.length,
        "acierto (±1 tramo)": pct(rows.filter((r) => r.correct).length / rows.length),
        "acierto exacto": pct(rows.filter((r) => r.exact).length / rows.length),
        "max conf. fallo": wrong.length ? Math.max(...wrong.map((r) => r.confidence ?? 0)).toFixed(2) : "—",
      };
    }),
  );
  const propose = (name: string, rows: Scored[]) => {
    const found = minScoreFor(rows, TARGET_PRECISION);
    console.log(
      found
        ? `${name} ≈ ${found.threshold.toFixed(3)} (acierto ${pct(found.precision)}, cubre ${pct(found.coverage)})`
        : `${name}: ningún umbral llega al acierto exigido.`,
    );
    return found;
  };
  const bandRows = first.filter((r) => r.kind !== "complexity");
  const confidence = {
    complexity: propose(
      "COMPLEXITY_MIN_CONFIDENCE",
      first.filter((r) => r.kind === "complexity").map((r) => ({ score: r.confidence ?? 0, correct: r.correct })),
    ),
    // Tramo exacto: la confianza tiene que acertar el tramo justo.
    exact: propose("BAND_EXACT_CONFIDENCE", bandRows.map((r) => ({ score: r.confidence ?? 0, correct: r.exact }))),
    // Tramo ampliado: el tramo elegido y sus vecinos tienen que contener el correcto (±1).
    mass: propose("BAND_MIN_MASS", bandRows.map((r) => ({ score: r.mass ?? 0, correct: r.correct }))),
  };
  const failed = first.filter((r) => !r.correct);
  if (failed.length) {
    console.log("Fallos (revisa también si la etiqueta era correcta):");
    console.table(failed.map((r) => ({ id: r.id, lang: r.lang, kind: r.kind, expected: r.expected, got: r.choice, confidence: r.confidence })));
  }

  const groups = new Map<string, ChoiceRun[]>();
  for (const r of choiceRuns) {
    const k = `${r.id}:${r.lang}:${r.kind}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const repeat = agreement([...groups.values()].map((rows) => rows.filter((r) => !r.reversed).map((r) => r.choice)));
  const flips = [...groups.values()].filter((rows) => {
    const normal = rows.find((r) => r.run === 0 && !r.reversed);
    return normal?.choice !== rows.find((r) => r.reversed)?.choice;
  }).length;
  console.log(`Misma respuesta en las ${RUNS} ejecuciones: ${pct(repeat)}`);
  console.log(`Cambia al invertir el orden de las opciones: ${flips} de ${groups.size} casos`);

  // ---- Especificidad (noul)
  console.log("\n== Especificidad (noul) ==");
  const firstNoul = noulRuns.filter((r) => r.run === 0 && r.noul !== null);
  for (const label of ["specific", "generic"] as const) {
    console.log(label.padEnd(10), summarize(firstNoul.filter((r) => r.label === label).map((r) => r.noul as number)));
  }
  const specificMin = minScoreFor(
    firstNoul.map((r) => ({ score: r.noul as number, correct: r.label === "specific" })),
    TARGET_PRECISION,
  );
  console.log(
    specificMin
      ? `SPECIFIC_MIN_NOUL ≈ ${specificMin.threshold.toFixed(3)} (acierto ${pct(specificMin.precision)}, cubre ${pct(specificMin.coverage)})`
      : "Ningún umbral separa lo específico de lo genérico con el acierto exigido.",
  );
  const genericMax = Math.max(...firstNoul.filter((r) => r.label === "generic").map((r) => r.noul as number));
  if (specificMin && genericMax >= specificMin.threshold) console.log("AVISO: alguna genérica pasa el umbral.");

  console.log(`\nModelo(s): ${[...models].join(", ") || "ninguno respondió"} · llamadas fallidas: ${failures}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir("docs/calibration", { recursive: true });
  const file = `docs/calibration/plan-${stamp}.json`;
  await writeFile(
    file,
    JSON.stringify({ date: new Date().toISOString(), models: [...models], failures, proposals: { confidence, specificMin }, choiceRuns, noulRuns }, null, 2),
  );
  console.log(`Detalle guardado en ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});