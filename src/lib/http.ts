import "server-only";
import { setTimeout as delay } from "node:timers/promises";

/** Utilidades HTTP comunes a los clientes de IA (Jev, GPT). */

// Las URLs alternativas solo existen para los servidores falsos de los tests.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAX_RETRY_DELAY_MS = 5_000;
// 429 límite de peticiones, 529 sobrecarga, resto errores temporales del servidor.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);

/**
 * URL de la API: la oficial, o la alternativa si apunta a localhost.
 * Cualquier otro host devuelve null, para que una variable mal puesta nunca envíe la clave a otro servidor.
 */
export function apiUrl(override: string | undefined, official: string): string | null {
  if (!override) return official;
  try {
    const url = new URL(override);
    return LOCAL_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface RetryOptions {
  /** Cancela la llamada (y los reintentos) cuando quien llama ya no necesita la respuesta. */
  signal?: AbortSignal;
  /** Solo para tests. */
  fetch?: typeof fetch;
  /** Solo para tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<unknown>;
}

export interface PostConfig {
  /** Nombre del servicio en los logs. */
  label: string;
  url: string;
  apiKey: string;
  body: string;
  timeoutMs: number;
  maxRetries: number;
}

/**
 * POST JSON con reintentos ante errores temporales. Devuelve la respuesta 2xx, o null si no se pudo
 * (el motivo va al log, nunca el cuerpo: podría repetir datos del usuario).
 * Si quien llama cancela, la cancelación se propaga tal cual, sin reintentar.
 */
export async function postJson(config: PostConfig, options: RetryOptions = {}): Promise<Response | null> {
  const { label, url, apiKey, body, timeoutMs, maxRetries } = config;
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number, signal?: AbortSignal) => delay(ms, undefined, { signal }));
  const { signal } = options;

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]),
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt < maxRetries) {
        await sleep(backoff(attempt), signal);
        continue;
      }
      console.error(`${label}: sin conexión o tiempo agotado tras los reintentos`);
      return null;
    }

    if (response.ok) return response;

    await response.body?.cancel();
    if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
      await sleep(retryAfter(response) ?? backoff(attempt), signal);
      continue;
    }
    console.error(`${label}: HTTP ${response.status}`);
    return null;
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

/** Rutas y códigos de un fallo de Zod, sin valores (pueden ser datos del usuario). */
export function issueCodes(issues: ReadonlyArray<{ path: PropertyKey[]; code: string }>) {
  return issues.map((issue) => `${issue.path.map(String).join(".")}:${issue.code}`).join(", ");
}