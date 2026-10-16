import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IDEA_MAX_LENGTH, parseIdea } from "../../src/lib/report/idea.ts";

describe("parseIdea", () => {
  it("acepta una idea y la recorta", () => {
    assert.deepEqual(parseIdea("  Un bar de tapas  "), { ok: true, idea: "Un bar de tapas" });
  });

  it("acepta exactamente el máximo", () => {
    assert.equal(parseIdea("a".repeat(IDEA_MAX_LENGTH)).ok, true);
  });

  it("rechaza más del máximo aunque el formulario lo impida", () => {
    assert.equal(parseIdea("a".repeat(IDEA_MAX_LENGTH + 1)).ok, false);
  });

  it("rechaza vacío, solo espacios y lo que no es texto", () => {
    for (const value of ["", "   \n\t", null, undefined, 42, {}]) {
      assert.equal(parseIdea(value).ok, false, String(value));
    }
  });
});