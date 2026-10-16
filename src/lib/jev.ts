import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

/**
 * Cliente de Jev (Typesafe, POST /v1/systemone). Docs: https://docs.typesafe.ai/api.md
 *
 * Cada respuesta se valida contra la pregunta enviada y se conservan la confianza y las
 * probabilidades: son las que después permiten separar lo SABIDO de lo ESTIMADO.
 * Una respuesta que falta o no encaja con su pregunta se devuelve como null (NO SABIDO);
 * nunca se rellena con un valor por defecto.
 */

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
// Solo versiones fijas: los alias (jev-latest, jev-preview) cambian solos con cada versión.
const PINNED_MODEL = /^jev-\d+\.\d+\.\d+$/;
const ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 5_000;
// 429 límite de peticiones, 529 sobrecarga, resto errores temporales del servidor.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);
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

export interface JevCallOptions {
  /** Cancela la llamada (y los reintentos) cuando quien llama ya no necesita la respuesta. */
  signal?: AbortSignal;
  /** Solo para tests. */
  fetch?: typeof fetch;
  /** Solo para tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<unknown>;
}

export async function callJev<const Q extends JevQuestions>(
  state: JevState,
  questions: Q,
  options: JevCallOptions = {},
): Promise<JevResult<Q>> {
  const { apiKey, model } = readConfig();

  const response = await postWithRetries(
    JSON.stringify({ state, model, questions }),
    apiKey,
    options,
  );

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    console.error("Jev: la respuesta no es JSON válido");
    throw new JevError("invalid_response");
  }

  const parsed = ResponseSchema.safeParse(body);
  if (!parsed.success) {
    // Solo rutas y códigos del fallo, nunca valores: el cuerpo puede contener datos del usuario.
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`);
    console.error(`Jev: respuesta con formato inesperado (${issues.join(", ")})`);
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
  return { apiKey, model };
}

async function postWithRetries(body: string, apiKey: string, options: JevCallOptions) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number, signal?: AbortSignal) => delay(ms, undefined, { signal }));
  const { signal } = options;

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await doFetch(JEV_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.any([AbortSignal.timeout(ATTEMPT_TIMEOUT_MS), ...(signal ? [signal] : [])]),
      });
    } catch (err) {
      // Cancelado por quien llama: se propaga tal cual, sin reintentar.
      if (signal?.aborted) throw err;
      if (attempt < MAX_RETRIES) {
        await sleep(backoff(attempt), signal);
        continue;
      }
      console.error("Jev: sin conexión o tiempo agotado tras los reintentos");
      throw new JevError("request_failed");
    }

    if (response.ok) return response;

    // El cuerpo de error no se registra: podría repetir el texto del usuario.
    await response.body?.cancel();
    if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
      await sleep(retryAfter(response) ?? backoff(attempt), signal);
      continue;
    }
    console.error(`Jev: HTTP ${response.status}`);
    throw new JevError("request_failed");
  }
}

/** 0,5 s, 1 s, 2 s... con un 25 % de variación aleatoria para no reintentar todos a la vez. */
function backoff(attempt: number) {
  const base = Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return Math.round(base * (1 + Math.random() * 0.25));
}

/** Respeta Retry-After en segundos, con un máximo para no bloquear la petición del usuario. */
function retryAfter(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
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