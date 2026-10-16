/**
 * Jev falso para los tests E2E: imita POST /v1/systemone con respuestas deterministas.
 * Escenarios por marcas en el texto del usuario (van dentro del state):
 *   [jev:unknown]  las preguntas choice responden "Not specified" si es una opción
 *   [jev:unsure]   confianza baja (0,40)
 *   [jev:down]     error 500 en todas las llamadas
 */
import { createServer, type ServerResponse } from "node:http";
import type { JevQuestion } from "../src/lib/jev.ts";

const PORT = 3102;
const API_KEY = "e2e-fake-key";

function answerFor(question: JevQuestion, text: string) {
  switch (question.type) {
    case "choice": {
      const options = Object.keys(question.criteria);
      const choice =
        text.includes("[jev:unknown]") && options.includes("Not specified") ? "Not specified" : options[0];
      const confidence = text.includes("[jev:unsure]") ? 0.4 : 0.95;
      const top = text.includes("[jev:unsure]") ? 0.5 : 0.95;
      const rest = options.length > 1 ? (1 - top) / (options.length - 1) : 0;
      const probabilities = Object.fromEntries(options.map((o) => [o, o === choice ? top : rest]));
      return { type: "choice", choice, probabilities, confidence };
    }
    case "score": {
      const levels = question.criteria.length;
      const probabilities = Object.fromEntries(question.criteria.map((_, i) => [String(i), i === levels - 1 ? 1 : 0]));
      return { type: "score", score: levels - 1, probabilities, confidence: 0.95 };
    }
    case "noul":
      return { type: "noul", noul: 0.8 };
  }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/v1/systemone") return send(res, 404);
  if (req.headers.authorization !== `Bearer ${API_KEY}`) return send(res, 401);

  let raw = "";
  for await (const chunk of req) raw += chunk;

  let body: { state?: unknown; model?: string; questions?: Record<string, JevQuestion> };
  try {
    body = JSON.parse(raw);
  } catch {
    return send(res, 400);
  }
  if (!body.model || !body.questions) return send(res, 422);

  const text = JSON.stringify(body.state ?? "");
  if (text.includes("[jev:down]")) return send(res, 500);

  const answers = Object.fromEntries(
    Object.entries(body.questions).map(([key, question]) => [key, answerFor(question, text)]),
  );
  send(res, 200, { model: body.model, answers, usage: { input_tokens: raw.length, output_tokens: 0 } });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Jev falso escuchando en http://127.0.0.1:${PORT}`);
});