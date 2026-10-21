import type { TaskStatus } from "./task.ts";
import type { Department } from "./line.ts";
import type { DoneTaskView, PlanView } from "./view.ts";

/**
 * Constelación del plan (vista Áreas): centro = el plan; primer anillo = departamentos (con su
 * progreso); segundo = líneas de trabajo; borde = tareas. Solo calcula posiciones.
 */

export const AREAS_MAP = { width: 920, height: 640, rDept: 110, rLine: 210, rTask: 290 } as const;

export interface AreasLayout {
  width: number;
  height: number;
  center: { x: number; y: number; done: number; total: number };
  departments: { department: Department; x: number; y: number; done: number; total: number }[];
  lines: { line: number; department: Department; goal: string; x: number; y: number; angle: number; fromX: number; fromY: number }[];
  tasks: { id: string; title: string; status: TaskStatus; line: number; x: number; y: number; right: boolean; fromX: number; fromY: number }[];
  /** Dependencias entre departamentos distintos (arcos por dentro del círculo). */
  edges: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[];
}

export function areasLayout(view: PlanView): AreasLayout {
  const { width, height, rDept, rLine, rTask } = AREAS_MAP;
  const cx = width / 2;
  const cy = height / 2;
  const at = (angle: number, r: number) => ({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });

  const all: DoneTaskView[] = view.phases.flatMap((group) => [...group.tasks, ...group.done]);
  const departmentsInPlan = [...new Set(view.lines.map((line) => line.department))];

  const departments: AreasLayout["departments"] = [];
  const lines: AreasLayout["lines"] = [];
  const tasks: AreasLayout["tasks"] = [];

  departmentsInPlan.forEach((department, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / departmentsInPlan.length;
    const hub = at(angle, rDept);
    const own = all.filter((task) => view.lines[task.line]?.department === department);
    departments.push({ department, ...hub, done: own.filter((t) => t.status === "done").length, total: own.length });

    const lineIndexes = view.lines.flatMap((line, index) => (line.department === department ? [index] : []));
    lineIndexes.forEach((lineIndex, j) => {
      const lineAngle = angle + (j - (lineIndexes.length - 1) / 2) * 0.42;
      const point = at(lineAngle, rLine);
      lines.push({
        line: lineIndex,
        department,
        goal: view.lines[lineIndex].goal,
        ...point,
        angle: lineAngle,
        fromX: hub.x,
        fromY: hub.y,
      });

      const lineTasks = all.filter((task) => task.line === lineIndex);
      lineTasks.forEach((task, k) => {
        const taskAngle = lineAngle + (k - (lineTasks.length - 1) / 2) * 0.17;
        const spot = at(taskAngle, rTask);
        tasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          line: lineIndex,
          ...spot,
          right: spot.x >= cx,
          fromX: point.x,
          fromY: point.y,
        });
      });
    });
  });

  const spotOf = new Map(tasks.map((task) => [task.id, task]));
  const departmentOf = (line: number) => view.lines[line]?.department;
  const edges: AreasLayout["edges"] = [];
  for (const task of all) {
    const to = spotOf.get(task.id);
    for (const dependency of task.dependsOn) {
      const from = spotOf.get(dependency);
      if (!from || !to || departmentOf(from.line) === departmentOf(to.line)) continue;
      edges.push({ from: from.id, to: to.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
  }

  return {
    width,
    height,
    center: { x: cx, y: cy, done: all.filter((t) => t.status === "done").length, total: all.length },
    departments,
    lines,
    tasks,
    edges,
  };
}