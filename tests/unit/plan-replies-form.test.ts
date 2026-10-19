import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DraftQuestion } from "../../src/lib/plan/answers.ts";
import { OTHER_REPLY, UNKNOWN_REPLY, parseReplies } from "../../src/lib/plan/replies-form.ts";

const QUESTIONS: DraftQuestion[] = [
  { id: "m#1", mold: "m", text: "¿Para llevar o para quedarse?", options: ["Para llevar", "Para quedarse"] },
  { id: "m#2", mold: "m", text: "¿Público?", options: ["Vecinos", "Oficinas"] },
];
const parse = (values: Record<string, string>) => parseReplies(QUESTIONS, (name) => values[name] ?? null);

describe("parseReplies", () => {
  it("opción, aún no lo sé y otra con texto", () => {
    assert.deepEqual(parse({ "q:m#1": "Para llevar", "q:m#2": UNKNOWN_REPLY }), {
      "m#1": { kind: "option", value: "Para llevar" },
      "m#2": { kind: "unknown" },
    });
    assert.deepEqual(parse({ "q:m#1": OTHER_REPLY, "other:m#1": "  Las dos  ", "q:m#2": "Vecinos" })?.["m#1"], {
      kind: "other",
      text: "Las dos",
    });
  });

  it("null si falta una, la opción no existe u 'otra' va vacía", () => {
    assert.equal(parse({ "q:m#1": "Para llevar" }), null);
    assert.equal(parse({ "q:m#1": "Inventada", "q:m#2": "Vecinos" }), null);
    assert.equal(parse({ "q:m#1": OTHER_REPLY, "other:m#1": "  ", "q:m#2": "Vecinos" }), null);
    assert.equal(parseReplies([], () => null), null);
  });
});