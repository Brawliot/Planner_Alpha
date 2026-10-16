import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { callJev, JevError, type JevQuestions } from "../../src/lib/jev.ts";

const QUESTIONS = {
  sector: {
    type: "choice",
    instructions: "What is the business sector?",
    criteria: { Hospitality: "Restaurants, bars", Software: "Apps, SaaS" },
  },
  clarity: {
    type: "score",
    instructions: "How clear is the idea?",
    criteria: ["Unclear", "Partly clear", "Clear"],
  },
  plausible: { type: "noul", instructions: "Is the figure plausible?" },
} satisfies JevQuestions;

const VALID_ANSWERS = {
  sector: {
    type: "choice",
    choice: "Hospitality",
    probabilities: { Hospitality: 0.9, Software: 0.1 },
    confidence: 0.8,
  },
  clarity: {
    type: "score",
    score: 1.7,
    probabilities: { "0": 0.1, "1": 0.1, "2": 0.8 },
    confidence: 0.6,
    legend: { "0": "Unclear", "1": "Partly clear", "2": "Clear" },
  },
  plausible: { type: "noul", noul: 0.85 },
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function okBody(answers: Record<string, unknown> = VALID_ANSWERS) {
  return { model: "jev-1.13.0", answers, usage: { input_tokens: 120, output_tokens: 0 } };
}

/** fetch falso que devuelve las respuestas en orden y guarda las llamadas. */
function fakeFetch(...responses: Array<() => Response>) {
  const calls: RequestInit[] = [];
  const impl = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {});
    const next = responses[calls.length - 1];
    if (!next) throw new Error("llamada de más");
    return next();
  }) as typeof fetch;
  return { impl, calls };
}

const sleeps: number[] = [];
const noSleep = async (ms: number) => {
  sleeps.push(ms);
};

beforeEach(() => {
  process.env.TYPESAFE_API_KEY = "test-key";
  process.env.JEV_MODEL = "jev-1.13.0";
  sleeps.length = 0;
  mock.method(console, "warn", () => {});
  mock.method(console, "error", () => {});
});

describe("callJev: respuestas válidas", () => {
  it("conserva choice, score y noul con confianza y probabilidades", async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(okBody()));
    const result = await callJev("Tapas bar in Madrid", QUESTIONS, { fetch: impl, sleep: noSleep });

    assert.equal(result.model, "jev-1.13.0");
    assert.deepEqual(result.answers.sector, {
      type: "choice",
      choice: "Hospitality",
      probabilities: { Hospitality: 0.9, Software: 0.1 },
      confidence: 0.8,
    });
    assert.equal(result.answers.clarity?.score, 1.7);
    assert.equal(result.answers.clarity?.confidence, 0.6);
    assert.equal(result.answers.plausible?.noul, 0.85);
    assert.deepEqual(result.usage, { input_tokens: 120, output_tokens: 0 });

    const sent = JSON.parse(String(calls[0].body));
    assert.equal(sent.model, "jev-1.13.0");
    assert.equal(sent.state, "Tapas bar in Madrid");
    assert.deepEqual(sent.questions, QUESTIONS);
    assert.equal((calls[0].headers as Record<string, string>).Authorization, "Bearer test-key");
  });
});

describe("callJev: respuestas que no encajan pasan a null (NO SABIDO)", () => {
  const cases: Array<[string, Record<string, unknown>, keyof typeof QUESTIONS]> = [
    ["falta la respuesta", { clarity: VALID_ANSWERS.clarity, plausible: VALID_ANSWERS.plausible }, "sector"],
    ["opción inventada", { ...VALID_ANSWERS, sector: { ...VALID_ANSWERS.sector, choice: "Hostelería" } }, "sector"],
    ["tipo distinto al preguntado", { ...VALID_ANSWERS, sector: VALID_ANSWERS.plausible }, "sector"],
    ["probabilidades que no suman 1", { ...VALID_ANSWERS, sector: { ...VALID_ANSWERS.sector, probabilities: { Hospitality: 0.9, Software: 0.5 } } }, "sector"],
    ["probabilidades con opciones de más", { ...VALID_ANSWERS, sector: { ...VALID_ANSWERS.sector, probabilities: { Hospitality: 0.9, Software: 0.05, Otra: 0.05 } } }, "sector"],
    ["score fuera de rango", { ...VALID_ANSWERS, clarity: { ...VALID_ANSWERS.clarity, score: 5 } }, "clarity"],
    ["confianza mayor que 1", { ...VALID_ANSWERS, clarity: { ...VALID_ANSWERS.clarity, confidence: 1.5 } }, "clarity"],
    ["noul fuera de 0-1", { ...VALID_ANSWERS, plausible: { type: "noul", noul: -0.2 } }, "plausible"],
  ];

  for (const [name, answers, key] of cases) {
    it(name, async () => {
      const { impl } = fakeFetch(() => jsonResponse(okBody(answers)));
      const result = await callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep });
      assert.equal(result.answers[key], null);
    });
  }
  
  it("acepta probabilidades redondeadas a 2 decimales que no suman exactamente 1", async () => {
    const answers = {
      ...VALID_ANSWERS,
      clarity: { ...VALID_ANSWERS.clarity, probabilities: { "0": 0.33, "1": 0.33, "2": 0.33 } },
    };
    const { impl } = fakeFetch(() => jsonResponse(okBody(answers)));
    const result = await callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep });
    assert.notEqual(result.answers.clarity, null);
  });

  it("una respuesta mala no invalida las demás", async () => {
    const answers = { ...VALID_ANSWERS, sector: { ...VALID_ANSWERS.sector, choice: "Hostelería" } };
    const { impl } = fakeFetch(() => jsonResponse(okBody(answers)));
    const result = await callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep });
    assert.equal(result.answers.sector, null);
    assert.equal(result.answers.plausible?.noul, 0.85);
  });
});

describe("callJev: errores y reintentos", () => {
  it("reintenta un 429 respetando Retry-After y luego responde", async () => {
    const { impl, calls } = fakeFetch(
      () => jsonResponse({}, 429, { "Retry-After": "2" }),
      () => jsonResponse(okBody()),
    );
    const result = await callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep });
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [2000]);
    assert.equal(result.answers.sector?.choice, "Hospitality");
  });

  it("se rinde tras 3 intentos con 529", async () => {
    const overloaded = () => jsonResponse({}, 529);
    const { impl, calls } = fakeFetch(overloaded, overloaded, overloaded);
    await assert.rejects(callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep }), { code: "request_failed" });
    assert.equal(calls.length, 3);
  });

  it("reintenta un fallo de red", async () => {
    const { impl, calls } = fakeFetch(
      () => {
        throw new TypeError("fetch failed");
      },
      () => jsonResponse(okBody()),
    );
    await callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep });
    assert.equal(calls.length, 2);
  });

  for (const status of [400, 401, 422]) {
    it(`no reintenta un ${status}`, async () => {
      const { impl, calls } = fakeFetch(() => jsonResponse({ error: "detalle" }, status));
      await assert.rejects(callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep }), JevError);
      assert.equal(calls.length, 1);
    });
  }

  it("no reintenta si quien llama cancela", async () => {
    const controller = new AbortController();
    const { impl, calls } = fakeFetch(() => {
      controller.abort();
      throw new DOMException("cancelado", "AbortError");
    });
    await assert.rejects(
      callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep, signal: controller.signal }),
      { name: "AbortError" },
    );
    assert.equal(calls.length, 1);
  });

  it("rechaza un cuerpo que no es JSON", async () => {
    const { impl } = fakeFetch(() => new Response("<html>", { status: 200 }));
    await assert.rejects(callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep }), { code: "invalid_response" });
  });

  it("rechaza un cuerpo sin answers", async () => {
    const { impl } = fakeFetch(() => jsonResponse({ model: "jev-1.13.0" }));
    await assert.rejects(callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep }), { code: "invalid_response" });
  });
});

describe("callJev: configuración", () => {
  for (const model of ["jev-latest", "jev-preview", ""]) {
    it(`rechaza JEV_MODEL="${model}" sin llamar a la API`, async () => {
      process.env.JEV_MODEL = model;
      const { impl, calls } = fakeFetch(() => jsonResponse(okBody()));
      await assert.rejects(callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep }), { code: "config" });
      assert.equal(calls.length, 0);
    });
  }

  it("rechaza si falta TYPESAFE_API_KEY", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const { impl, calls } = fakeFetch(() => jsonResponse(okBody()));
    await assert.rejects(callJev("idea", QUESTIONS, { fetch: impl, sleep: noSleep }), { code: "config" });
    assert.equal(calls.length, 0);
  });
});