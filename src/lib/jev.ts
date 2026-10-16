import "server-only";
import { z } from "zod";
import { apiUrl, issueCodes, postJson, type RetryOptions } from "./http.ts";

/**
 * Cliente de Jev (Typesafe, POST /v1/systemone). Docs: https://docs.typesafe.ai/api.md
 *
 * Cada respuesta se valida contra la pregunta enviada y se conservan la confianza y las
 * probabilidades: son las que después permiten separar lo SABIDO de lo ESTIMADO.
 * Una respuesta que falta o no encaja con su pregunta se devuelve como null (NO SABIDO);
 * nunca se rellena con un valor por defecto.
 */

const OFFICIAL_URL = "https://api.typesafe.ai/v1/systemone";
// Solo versiones fijas: los alias (jev-latest, jev-preview) cambian solos con cada versión.
const PINNED_MODEL = /^jev-\d+\.\d+\.\d+$/;
const ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
// Jev redondea cada probabilidad a 2 decimales: la suma puede desviarse hasta 0,005 por opción.
const PROBABILITY_ROUNDING = 0.005;

export type JevQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } };

export type JevQuestions = Record<string, JevQuestion>;

/** Lo que Jev analiza: texto o JSON. El texto del usuario va siempre aquí, nunca en instructions ni criteria. */
export type JevState = string | Record<string, unknown> | unknown[];

const unit = z.number().min(0).max(1);
const probabilities = z.record(z.string(), unit);

const AnswerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choice"), choice: z.string(), probabilities, confidence: unit }),
  z.object({ type: z.literal("score"), score: z.number(), probabilities, confidence: unit }),
  z.object({ type: z.literal("noul"), noul: unit }),
]);

// Las respuestas se validan una a una: una mal formada no invalida las demás.
const ResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), z.unknown()),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }).optional(),
});

export type JevAnswer = z.infer<typeof AnswerSchema>;
export type JevChoiceAnswer = Extract<JevAnswer, { type: "choice" }>;
export type JevScoreAnswer = Extract<JevAnswer, { type: "score" }>;
export type JevNoulAnswer = Extract<JevAnswer, { type: "noul" }>;

type AnswerFor<Q extends JevQuestion> = Q extends { type: "choice" }
  ? JevChoiceAnswer
  : Q extends { type: "score" }
    ? JevScoreAnswer
    : JevNoulAnswer;

export interface JevResult<Q extends JevQuestions> {
  /** Modelo que respondió realmente; se guarda con cada informe para poder reproducirlo. */
  model: string;
  /** null = sin respuesta válida para esa pregunta: se trata como NO SABIDO. */
  answers: { [K in keyof Q]: AnswerFor<Q[K]> | null };
  usage: { input_tokens: number; output_tokens: number } | null;
}

export type JevErrorCode = "config" | "request_failed" | "invalid_response";

/** El mensaje es genérico a propósito; el detalle técnico solo va al log del servidor. */
export class JevError extends Error {
  readonly code: JevErrorCode;

  constructor(code: JevErrorCode) {
    super("El servicio de análisis no está disponible");
    this.name = "JevError";
    this.code = code;
  }
}

export type JevCallOptions = RetryOptions;

export async function callJev<const Q extends JevQuestions>(
  state: JevState,
  questions: Q,
  options: JevCallOptions = {},
): Promise<JevResult<Q>> {
  const { apiKey, model, url } = readConfig();

  const response = await postJson(
    {
      label: "Jev",
      url,
      apiKey,
      body: JSON.stringify({ state, model, questions }),
      timeoutMs: ATTEMPT_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    },
    options,
  );
  if (!response) throw new JevError("request_failed");

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    console.error("Jev: la respuesta no es JSON válido");
    throw new JevError("invalid_response");
  }

  const parsed = ResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error(`Jev: respuesta con formato inesperado (${issueCodes(parsed.error.issues)})`);
    throw new JevError("invalid_response");
  }

  const answers: Record<string, JevAnswer | null> = {};
  for (const [key, question] of Object.entries(questions)) {
    const raw = Object.hasOwn(parsed.data.answers, key) ? parsed.data.answers[key] : undefined;
    const result = validateAnswer(question, raw);
    if (typeof result === "string") {
      console.warn(`Jev: respuesta "${key}" descartada (${result})`);
      answers[key] = null;
    } else {
      answers[key] = result;
    }
  }

  return {
    model: parsed.data.model,
    answers: answers as JevResult<Q>["answers"],
    usage: parsed.data.usage ?? null,
  };
}

function readConfig() {
  const apiKey = process.env.TYPESAFE_API_KEY;
  const model = process.env.JEV_MODEL;
  if (!apiKey || !model || !PINNED_MODEL.test(model)) {
    console.error("Jev: falta TYPESAFE_API_KEY o JEV_MODEL no es una versión fija (jev-X.Y.Z)");
    throw new JevError("config");
  }
  const url = apiUrl(process.env.JEV_API_URL, OFFICIAL_URL);
  if (!url) {
    console.error("Jev: JEV_API_URL solo puede apuntar a localhost");
    throw new JevError("config");
  }
  return { apiKey, model, url };
}

/** Devuelve la respuesta si encaja con la pregunta, o el motivo por el que se descarta. */
function validateAnswer(question: JevQuestion, raw: unknown): JevAnswer | string {
  if (raw === undefined) return "missing";
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success) return "malformed";
  const answer = parsed.data;
  if (answer.type !== question.type) return "type_mismatch";

  if (question.type === "choice" && answer.type === "choice") {
    const options = Object.keys(question.criteria);
    if (!options.includes(answer.choice)) return "unknown_option";
    const problem = distributionProblem(answer.probabilities, options);
    if (problem) return problem;
  }

  if (question.type === "score" && answer.type === "score") {
    const levels = question.criteria.map((_, index) => String(index));
    if (answer.score < 0 || answer.score > levels.length - 1) return "out_of_range";
    const problem = distributionProblem(answer.probabilities, levels);
    if (problem) return problem;
  }

  return answer;
}

/** Una probabilidad por cada clave esperada, ni más ni menos, y que sumen 1 salvo redondeo. */
function distributionProblem(probs: Record<string, number>, keys: string[]) {
  const received = Object.keys(probs);
  if (received.length !== keys.length || !keys.every((key) => Object.hasOwn(probs, key))) {
    return "probability_keys";
  }
  const sum = received.reduce((total, key) => total + probs[key], 0);
  const tolerance = PROBABILITY_ROUNDING * keys.length + 1e-9;
  return Math.abs(sum - 1) <= tolerance ? null : "probability_sum";
}