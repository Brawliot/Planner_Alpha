/**
 * GPT falso para los tests E2E: imita POST /v1/responses con Structured Outputs.
 * Rellena cualquier esquema JSON con valores válidos (en un enum, la primera opción).
 * Escenarios por marcas en el texto del usuario (van dentro de input):
 *   [gpt:down]    error 500
 *   [gpt:refuse]  el modelo se niega
 *   [gpt:cannot]  en los enums que lo permiten, elige "Cannot infer"
 */
import { createServer, type ServerResponse } from "node:http";

const PORT = 3103;
const API_KEY = "e2e-fake-key";

type Schema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, Schema>;
  items?: Schema;
};

function fill(schema: Schema, text: string): unknown {
  if (schema.enum) {
    if (text.includes("[gpt:cannot]") && schema.enum.includes("Cannot infer")) return "Cannot infer";
    return schema.enum[0];
  }
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "object":
      return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, s]) => [key, fill(s, text)]));
    case "array":
      return schema.items ? [fill(schema.items, text)] : [];
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    default:
      return "Fake assumption";
  }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function message(content: unknown) {
  return [{ type: "message", role: "assistant", content: [content] }];
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/v1/responses") return send(res, 404);
  if (req.headers.authorization !== `Bearer ${API_KEY}`) return send(res, 401);

  let raw = "";
  for await (const chunk of req) raw += chunk;

  let body: { model?: string; input?: unknown; store?: boolean; text?: { format?: { type?: string; strict?: boolean; schema?: Schema } } };
  try {
    body = JSON.parse(raw);
  } catch {
    return send(res, 400);
  }
  const format = body.text?.format;
  // La app siempre debe pedir Structured Outputs estricto y sin almacenamiento.
  if (!body.model || body.store !== false || format?.type !== "json_schema" || format.strict !== true || !format.schema) {
    return send(res, 422);
  }

  const text = JSON.stringify(body.input ?? "");
  if (text.includes("[gpt:down]")) return send(res, 500);

  const output = text.includes("[gpt:refuse]")
    ? message({ type: "refusal", refusal: "I can't help with that." })
    : message({ type: "output_text", text: JSON.stringify(fill(format.schema, text)) });

  send(res, 200, {
    model: body.model,
    status: "completed",
    output,
    usage: { input_tokens: raw.length, output_tokens: 10, output_tokens_details: { reasoning_tokens: 0 } },
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`GPT falso escuchando en http://127.0.0.1:${PORT}`);
});