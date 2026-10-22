import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areaSignals } from "../../src/lib/plan/areas-tree.ts";
import { MOLDS } from "../../src/lib/plan/catalog.ts";
import { rebuildPlan } from "../../src/lib/plan/orchestrator.ts";
import { prefillConfig } from "../../src/lib/plan/prefill.ts";
import { TRACK, timelineTrack, type TrackBar } from "../../src/lib/plan/timeline-track.ts";
import { planView } from "../../src/lib/plan/view.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";
import { EXAMPLES } from "../../scripts/plan-examples.ts";

const { facts, config: extra } = EXAMPLES.cafe;
const today = "2026-10-19";
const config = { ...prefillConfig(facts, today).config, ...extra };
const state = rebuildPlan({
  report: { facts, verdicts: areaVerdicts(facts), language: "es", fingerprint: "test" },
  config,
  catalog: MOLDS,
  stored: null,
  today,
});
const view = planView({ state, config, catalog: MOLDS, facts, language: "es" });
const pending = view.phases.flatMap((p) => p.tasks);
const departments = [...new Set(view.lines.map((l) => l.department))];
const everything = new Set(departments);

const insideWindow = (bar: TrackBar, from: number, to: number) =>
  bar.start >= from && bar.endMax <= to && bar.start <= bar.endMin + 1e-9 && bar.endMin <= bar.endMax + 1e-9;

describe("timelineTrack", () => {
  it("próximas semanas: una ventana de 12 semanas", () => {
    const track = timelineTrack(view, config.startDate);
    assert.equal(track.to - track.from, TRACK.nextWeeks);
  });

  it("todo el plan: empieza en 0 y ninguna barra se sale", () => {
    const track = timelineTrack(view, config.startDate, everything, "all");
    assert.equal(track.from, 0);
    for (const row of track.rows) {
      if (row.kind === "task") assert.equal(row.bar?.beyond ?? null, null);
      if (row.kind === "department") assert.ok(row.segments.every((s) => s.beyond === null));
    }
  });

  it("plegado: solo filas de departamento, una por departamento", () => {
    const track = timelineTrack(view, config.startDate);
    assert.deepEqual(
      track.rows.map((r) => (r.kind === "department" ? r.department : r.kind)),
      departments,
    );
  });

  it("abierto: las tareas pendientes del departamento, una vez cada una", () => {
    for (const department of departments) {
      const track = timelineTrack(view, config.startDate, new Set([department]));
      const ids = track.rows.flatMap((r) => (r.kind === "task" ? [r.id] : []));
      const expected = pending.filter((t) => view.lines[t.line].department === department).map((t) => t.id);
      assert.deepEqual(ids.sort(), expected.sort());
    }
  });

  it("las barras nunca se salen de la ventana; beyond y startsAt solo cuando toca", () => {
    const track = timelineTrack(view, config.startDate, everything);
    for (const row of track.rows) {
      if (row.kind !== "task") continue;
      const task = pending.find((t) => t.id === row.id)!;
      const realEnd = task.schedule.endMax / 7;
      if (row.bar) {
        assert.ok(insideWindow(row.bar, track.from, track.to), row.id);
        assert.equal(row.bar.beyond !== null, realEnd > track.to, row.id);
      } else {
        assert.ok(task.schedule.start / 7 >= track.to || realEnd <= track.from, row.id);
      }
      assert.equal(row.startsAt !== null, task.schedule.start / 7 >= track.to, row.id);
    }
    for (const row of track.rows) {
      if (row.kind === "department") for (const s of row.segments) assert.ok(insideWindow(s, track.from, track.to));
    }
  });

  it("más adelante en el tiempo, la ventana se desplaza y recorta", () => {
    const later = new Date(Date.parse(`${config.startDate}T00:00:00Z`) + 5 * 7 * 86_400_000).toISOString().slice(0, 10);
    const track = timelineTrack(view, later, everything);
    assert.equal(track.from, 5);
    for (const row of track.rows) if (row.kind === "task" && row.bar) assert.ok(row.bar.start >= 5);
  });

  it("los meses van en orden, el primero al inicio de la ventana y con el año", () => {
    const track = timelineTrack(view, config.startDate, new Set(), "all");
    assert.equal(track.months[0].week, track.from);
    assert.match(track.months[0].label, /\d{4}$/);
    for (let i = 1; i < track.months.length; i++) assert.ok(track.months[i].week > track.months[i - 1].week);
  });

  it("las señales coinciden con las de la vista Áreas", () => {
    const signals = new Map(areaSignals(view).map((s) => [s.department, s]));
    for (const row of timelineTrack(view, config.startDate).rows) {
      if (row.kind === "department") assert.deepEqual(row.signal, signals.get(row.department));
    }
  });

  it("\"ahora\" marca las tareas de la lista Ahora", () => {
    const now = new Set(view.now.map((n) => n.taskId));
    for (const row of timelineTrack(view, config.startDate, everything).rows) {
      if (row.kind === "task") assert.equal(row.now, now.has(row.id));
    }
  });

  it("hoy y la apertura quedan dentro de la ventana", () => {
    const track = timelineTrack(view, config.startDate, new Set(), "all");
    if (track.today !== null) assert.ok(track.today >= track.from && track.today <= track.to);
    if (track.opening) assert.ok(track.opening.start >= track.from && track.opening.end <= track.to && track.opening.start < track.opening.end);
  });
});