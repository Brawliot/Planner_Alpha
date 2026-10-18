import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Step } from "../../src/lib/plan/step.ts";
import type { Range, Task } from "../../src/lib/plan/task.ts";
import {
  addDays,
  buildTimeline,
  daysBetween,
  deadlineStatus,
  weeklyHoursOf,
  weeksOf,
} from "../../src/lib/plan/timeline.ts";

const fixed = (n: number): Range => ({ min: n, max: n });

function step(effort: Range, wait?: Range, status: Step["status"] = "todo"): Step {
  return {
    id: "s",
    order: 0,
    text: "s",
    doneWhen: "s",
    suggestedActor: wait ? "third_party" : "user",
    allowedActors: ["user", "third_party"],
    actor: wait ? "third_party" : "user",
    effort,
    ...(wait ? { thirdParty: "advisor" as const, wait } : {}),
    status,
  };
}

function task(id: string, s: Step, extra: Partial<Task> = {}): Task {
  return {
    id,
    lineId: "l",
    phase: "prepare",
    kind: "action",
    title: id,
    outcome: id,
    dependsOn: [],
    basis: [],
    validation: "per_step",
    origin: "catalog",
    steps: [s],
    ...extra,
  };
}

/** 7 h/semana = 1 h/día: las cuentas salen en días exactos. */
const ONE_HOUR_A_DAY = fixed(7);
const timeline = (tasks: Task[], weeklyHours = ONE_HOUR_A_DAY, today = "2026-11-03") =>
  buildTimeline({ tasks, startDate: "2026-11-03", today, weeklyHours });
const of = (t: ReturnType<typeof timeline>, id: string) => t.tasks.find((s) => s.taskId === id)!;

describe("weeklyHoursOf", () => {
  it("traduce la dedicación del informe y null si no se sabe", () => {
    assert.deepEqual(weeklyHoursOf("10-20 h/week"), { min: 10, max: 20 });
    assert.equal(weeklyHoursOf("Not decided yet"), null);
    assert.equal(weeklyHoursOf(null), null);
  });
});

describe("buildTimeline", () => {
  it("una dependencia empieza cuando acaba la anterior", () => {
    const t = timeline([task("a", step(fixed(7))), task("b", step(fixed(7)), { dependsOn: ["a"] })]);
    assert.deepEqual(of(t, "a"), { taskId: "a", start: fixed(0), end: fixed(7) });
    assert.deepEqual(of(t, "b"), { taskId: "b", start: fixed(7), end: fixed(14) });
    assert.deepEqual(t.end, fixed(14));
  });

  it("mientras esperas a un tercero haces otra cosa", () => {
    const t = timeline([
      task("a", step(fixed(7), fixed(14))),
      task("b", step(fixed(7))),
      task("c", step(fixed(7)), { dependsOn: ["a"] }),
    ]);
    assert.deepEqual(of(t, "b").start, fixed(7));
    assert.deepEqual(of(t, "c").start, fixed(21));
    assert.deepEqual(weeksOf(of(t, "c")), { from: 4, to: 4 });
  });

  it("la fase es prioridad, no puerta", () => {
    const t = timeline([task("prep", step(fixed(7))), task("val", step(fixed(7)), { phase: "validate" })]);
    assert.deepEqual(of(t, "val").start, fixed(0));
    assert.deepEqual(of(t, "prep").start, fixed(7));
  });

  it("rápido y lento: mínimos con más horas, máximos con menos", () => {
    const t = timeline([task("a", step({ min: 7, max: 14 }))], { min: 7, max: 14 });
    assert.deepEqual(of(t, "a").end, { min: 3.5, max: 14 });
  });

  it("lo hecho queda fuera y lo pendiente empieza hoy", () => {
    const t = timeline(
      [task("done", step(fixed(7), undefined, "done")), task("next", step(fixed(7)), { dependsOn: ["done"] })],
      ONE_HOUR_A_DAY,
      "2026-11-17",
    );
    assert.equal(t.tasks.length, 1);
    assert.deepEqual(of(t, "next").start, fixed(14));
    assert.deepEqual(weeksOf(of(t, "next")), { from: 3, to: 3 });
  });

  it("si aún no ha llegado el inicio, empieza el día de inicio", () => {
    const t = timeline([task("a", step(fixed(7)))], ONE_HOUR_A_DAY, "2026-10-20");
    assert.deepEqual(of(t, "a").start, fixed(0));
  });
});

describe("fechas", () => {
  it("cuenta días y suma días en UTC", () => {
    assert.equal(daysBetween("2026-11-03", "2026-11-17"), 14);
    assert.equal(addDays("2026-11-03", 14.9), "2026-11-17");
  });
});


describe("periodos sin disponibilidad", () => {
  const withBreak = (unavailable: { from: string; to: string }[], tasks: Task[]) =>
    buildTimeline({ tasks, startDate: "2026-11-03", today: "2026-11-03", weeklyHours: ONE_HOUR_A_DAY, unavailable });

  it("una tarea a medias se pausa durante el periodo y sigue a la vuelta", () => {
    // 7 días de trabajo; libres del día 2 al 8 (ambos incluidos): 2 antes + 5 después.
    const t = withBreak([{ from: "2026-11-05", to: "2026-11-11" }], [task("a", step(fixed(7)))]);
    assert.deepEqual(of(t, "a"), { taskId: "a", start: fixed(0), end: fixed(14) });
  });

  it("si tocaba empezar en el periodo, empieza al volver", () => {
    const t = withBreak([{ from: "2026-11-03", to: "2026-11-09" }], [task("a", step(fixed(7)))]);
    assert.deepEqual(of(t, "a").start, fixed(7));
    assert.deepEqual(of(t, "a").end, fixed(14));
  });

  it("periodos solapados o desordenados se saltan en cadena", () => {
    const t = withBreak(
      [
        { from: "2026-11-06", to: "2026-11-09" },
        { from: "2026-11-03", to: "2026-11-07" },
      ],
      [task("a", step(fixed(7)))],
    );
    assert.deepEqual(of(t, "a").start, fixed(7));
  });
});

describe("deadlineStatus", () => {
  const t = timeline([task("a", step({ min: 7, max: 14 }))]);

  it("a tiempo, en riesgo o tarde", () => {
    assert.deepEqual(t.end, { min: 7, max: 14 });
    assert.equal(deadlineStatus(t, "2026-11-03", "2026-11-20"), "on_track");
    assert.equal(deadlineStatus(t, "2026-11-03", "2026-11-12"), "at_risk");
    assert.equal(deadlineStatus(t, "2026-11-03", "2026-11-05"), "late");
  });

  it("terminar el mismo día límite es llegar", () => {
    // Fin a los 14 días = final del día 2026-11-16.
    assert.equal(deadlineStatus(t, "2026-11-03", "2026-11-16"), "on_track");
  });
});