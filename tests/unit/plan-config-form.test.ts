import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig } from "../../src/lib/plan/config.ts";
import { hoursOptionOf, parseConfigForm } from "../../src/lib/plan/config-form.ts";

const current = { ...defaultConfig("2026-10-26", { min: 10, max: 20 }), skills: ["design" as const], employed: true };

function form(values: Record<string, string | string[]>) {
  const all = (name: string) => {
    const value = values[name];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  };
  return {
    get: (name: string) => all(name)[0] ?? null,
    getAll: all,
  };
}

const VALID = {
  startDate: "2026-11-02",
  hours: "20-40",
  delegation: ["self", "ai"],
  professionals: ["advisor"],
  validationLevel: "3",
  launchLevel: "1",
};

const parse = (values: Record<string, string | string[]>) => {
  const f = form(values);
  return parseConfigForm(current, f.get, f.getAll);
};

describe("parseConfigForm", () => {
  it("cambia lo del formulario y conserva el resto", () => {
    const result = parse(VALID);
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.config.startDate, "2026-11-02");
    assert.deepEqual(result.config.weeklyHours, { min: 20, max: 40 });
    assert.deepEqual(result.config.delegation, ["self", "ai"]);
    assert.deepEqual(result.config.professionals, ["advisor"]);
    assert.equal(result.config.validationLevel, 3);
    assert.equal(result.config.launchLevel, 1);
    assert.deepEqual(result.config.skills, ["design"]);
    assert.equal(result.config.employed, true);
  });

  it("sin profesionales también vale", () => {
    assert.ok(parse({ ...VALID, professionals: [] }).ok);
  });

  it("rechaza horas desconocidas, reparto vacío, fechas y niveles inválidos u opciones inventadas", () => {
    assert.equal(parse({ ...VALID, hours: "7-9" }).ok, false);
    assert.equal(parse({ ...VALID, delegation: [] }).ok, false);
    assert.equal(parse({ ...VALID, startDate: "02/11/2026" }).ok, false);
    assert.equal(parse({ ...VALID, validationLevel: "4" }).ok, false);
    assert.equal(parse({ ...VALID, delegation: ["robot"] }).ok, false);
    assert.equal(parse({ ...VALID, professionals: ["astrologer"] }).ok, false);
  });
});

describe("hoursOptionOf", () => {
  it("encuentra la opción o null", () => {
    assert.equal(hoursOptionOf({ min: 10, max: 20 }), "10-20");
    assert.equal(hoursOptionOf({ min: 12, max: 20 }), null);
  });
});