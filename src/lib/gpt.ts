import "server-only";
import { z } from "zod";
import { apiUrl, issueCodes, postJson, type RetryOptions } from "./http.ts";

/**
 * Cliente de GPT (OpenAI Responses API, POST /v1/responses) con Structured Outputs estricto.
 * Docs: https://developers.openai.com/api/docs/guides/structured-outputs
 *
 * strict garantiza la forma del JSON, no que los valores sean ciertos ni sensatos:
 * el resultado se vuelve a validar aquí con Zod antes de usarlo.
 */

const OFFICIAL_URL = "https://api.openai.com/v1/responses";
const ATTEMPT_TIMEOUT_MS = 60_000;
// Una respuesta con razonamiento tarda: más de un reintento haría esperar demasiado al usuario.
const MAX_RETRIES = 1;
// Reserva para razonamiento + salida (OpenAI recomienda al menos 25.000 al empezar).
const MAX_OUTPUT_TOKENS = 25_000;

export type GptTask = "infer" | "write";
const MODEL_ENV: Record<GptTask, string> = { infer: "GPT_MODEL_INFER", write: "GPT_MODEL_WRITE" };

export type ReasoningEffort = "low" | "medium" | "high";

export interface GptRequest<T> {
  task: GptTask;
  /** Instrucciones fijas del código. Nunca contienen texto del usuario. */
  instructions: string;
  /** Datos de entrada (incluido el texto del usuario): van siempre como JSON en el mensaje de usuario. */
  input: unknown;
  /** Structured Outputs: raíz objeto, additionalProperties false y todos los campos en required. */
  format: { name: string; schema: Record<string, unknown> };
  /** Validación en servidor del resultado. */
  parse: z.ZodType<T>;
  effort: ReasoningEffort;
}

export interface GptResult<T> {
  data: T;
  /** Modelo que respondió realmente; se guarda con cada dato inferido. */
  model: string;
  usage: { input_tokens: number; output_tokens: number; reasoning_tokens: number } | null;
}

export type GptErrorCode = "config" | "request_failed" | "invalid_response" | "refused" | "incomplete";

/** El mensaje es genérico a propósito; el detalle técnico solo va al log del servidor. */
export class GptError extends Error {
  readonly code: GptErrorCode;

  constructor(code: GptErrorCode) {
    super("El servicio de análisis no está disponible");
    this.name = "GptError";
    this.code = code;
  }
}

const ResponseSchema = z.object({
  model: z.string(),
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional(), refusal: z.string().optional() }))
        .optional(),
    }),
  ),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      output_tokens_details: z.object({ reasoning_tokens: z.number() }).optional(),
    })
    .optional(),
});

export async function callGpt<T>(request: GptRequest<T>, options: RetryOptions = {}): Promise<GptResult<T>> {
  const { apiKey, model, url } = readConfig(request.task);

  const body = JSON.stringify({
    model,
    instructions: request.instructions,
    input: [{ role: "user", content: JSON.stringify(request.input) }],
    text: {
      format: { type: "json_schema", name: request.format.name, schema: request.format.schema, strict: true },
    },
    reasoning: { effort: request.effort },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    // Que OpenAI no guarde la respuesta: los datos del usuario no se quedan allí.
    store: false,
  });

  const response = await postJson(
    { label: "GPT", url, apiKey, body, timeoutMs: ATTEMPT_TIMEOUT_MS, maxRetries: MAX_RETRIES },
    options,
  );
  if (!response) throw new GptError("request_failed");

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    console.error("GPT: la respuesta no es JSON válido");
    throw new GptError("invalid_response");
  }

  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`GPT: respuesta con formato inesperado (${issueCodes(parsed.error.issues)})`);
    throw new GptError("invalid_response");
  }

  const content = parsed.data.output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []);
  if (content.some((part) => part.type === "refusal")) {
    console.warn("GPT: el modelo se ha negado a responder");
    throw new GptError("refused");
  }
  // Una respuesta incompleta (límite de tokens, filtro) puede traer JSON cortado: no se usa.
  if (parsed.data.status !== "completed") {
    console.error(`GPT: respuesta con estado ${parsed.data.status}`);
    throw new GptError("incomplete");
  }

  const text = content.find((part) => part.type === "output_text")?.text;
  let json: unknown;
  try {
    json = JSON.parse(text ?? "");
  } catch {
    console.error("GPT: la salida no es JSON válido");
    throw new GptError("invalid_response");
  }

  const result = request.parse.safeParse(json);
  if (!result.success) {
    console.error(`GPT: la salida no cumple el esquema (${issueCodes(result.error.issues)})`);
    throw new GptError("invalid_response");
  }

  const usage = parsed.data.usage;
  return {
    data: result.data,
    model: parsed.data.model,
    usage: usage
      ? {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          reasoning_tokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
        }
      : null,
  };
}

function readConfig(task: GptTask) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env[MODEL_ENV[task]];
  // Los alias *-latest cambian solos: el comportamiento del informe dejaría de ser reproducible.
  if (!apiKey || !model || model.includes("latest")) {
    console.error(`GPT: falta OPENAI_API_KEY o ${MODEL_ENV[task]} (no se admiten alias *-latest)`);
    throw new GptError("config");
  }
  const url = apiUrl(process.env.OPENAI_API_URL, OFFICIAL_URL);
  if (!url) {
    console.error("GPT: OPENAI_API_URL solo puede apuntar a localhost");
    throw new GptError("config");
  }
  return { apiKey, model, url };
}