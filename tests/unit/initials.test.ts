import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initials } from "../../src/lib/initials.ts";

describe("initials", () => {
  it("toma la primera letra del nombre y de los apellidos", () => {
    assert.equal(initials("Ana", "Pérez García"), "AP");
  });

  it("con nombres compuestos usa solo la primera letra de cada campo", () => {
    assert.equal(initials("María José", "de la Fuente"), "MD");
  });

  it("sin apellidos (usuarios antiguos) usa solo el nombre", () => {
    assert.equal(initials("ana", null), "A");
    assert.equal(initials("ana", undefined), "A");
    assert.equal(initials("ana", "   "), "A");
  });

  it("respeta los acentos y quita espacios", () => {
    assert.equal(initials("  élia ", "ñúñez"), "ÉÑ");
  });

  it("sin datos devuelve ?", () => {
    assert.equal(initials("", null), "?");
  });
});