import type { TaskStatus } from "./task.ts";
import type { Department } from "./line.ts";
import type { DoneTaskView, PlanView } from "./view.ts";

/**
 * Constelación del plan (vista Áreas) en dos capas: todas las áreas (departamentos con su progreso
 * y enlaces entre ellos) o un departamento enfocado (sus objetivos y tareas). Solo calcula posiciones.
 */

export const AREAS_LAYERS = {
  width: 920,
  height: 640,
  ring: 210,
  minNode: 24,
  nodePerSqrt: 11,
  objectiveRadius: 150,
  taskRadius: 255,
  /** Hueco libre arriba (radianes) para que nada toque la fila de pastillas. */
  topGap: 0.8,
  pillWidth: 130,
  maxLabels: 10,
} as const;

type Point = { x: number; y: number };
export type StatusCounts = { done: number; doing: number; waiting: number; todo: number };

export interface AreasOverview {
  width: number;
  height: number;
  center: Point & { done: number; total: number };
  departments: (Point & { department: Department; r: number; done: number; total: number; counts: StatusCounts })[];
  /** Un enlace por pareja de departamentos con dependencias entre sus tareas (en cualquier sentido). */
  links: { a: Department; b: Department; count: number; from: Point; control: Point; to: Point; badge: Point }[];
}

export interface AreasFocus {
  width: number;
  height: number;
  center: Point & { department: Department; done: number; total: number };
  pills: (Point & { department: Department; width: number; done: number; total: number })[];
  objectives: (Point & { line: number; goal: string; angle: number; right: boolean })[];
  tasks: (Point & { id: string; title: string; status: TaskStatus; line: number; right: boolean; label: boolean; from: Point })[];
  /** Dependencias entre tareas del departamento. */
  inner: { from: string; to: string; a: Point; b: Point }[];
  /** Una línea por departamento conectado, del centro a su pastilla, con cuántas dependencias hay. */
  outer: { department: Department; count: number; from: Point; to: Point }[];
}

const countsOf = (tasks: readonly DoneTaskView[]): StatusCounts => ({
  done: tasks.filter((t) => t.status === "done").length,
  doing: tasks.filter((t) => t.status === "doing").length,
  waiting: tasks.filter((t) => t.status === "waiting").length,
  todo: tasks.filter((t) => t.status === "todo" || t.status === "blocked").length,
});

function planTasks(view: PlanView) {
  return view.phases.flatMap((group) => [...group.tasks, ...group.done]);
}

function departmentsOf(view: PlanView) {
  return [...new Set(view.lines.map((line) => line.department))];
}

export function areasOverview(view: PlanView): AreasOverview {
  const { width, height, ring, minNode, nodePerSqrt } = AREAS_LAYERS;
  const center = { x: width / 2, y: height / 2 + 10 };
  const all = planTasks(view);
  const departmentOf = (line: number) => view.lines[line]?.department;
  const departments = departmentsOf(view);

  const nodes = departments.map((department, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / departments.length;
    const own = all.filter((t) => departmentOf(t.line) === department);
    return {
      department,
      x: center.x + Math.cos(angle) * ring,
      y: center.y + Math.sin(angle) * ring,
      r: minNode + Math.sqrt(own.length) * nodePerSqrt,
      done: own.filter((t) => t.status === "done").length,
      total: own.length,
      counts: countsOf(own),
    };
  });
  const nodeOf = new Map(nodes.map((n) => [n.department, n]));

  // Parejas de departamentos con dependencias (sin dirección: una curva por pareja).
  const pairs = new Map<string, { a: Department; b: Department; count: number }>();
  for (const task of all) {
    for (const dependency of task.dependsOn) {
      const from = all.find((t) => t.id === dependency);
      const a = from ? departmentOf(from.line) : undefined;
      const b = departmentOf(task.line);
      if (!a || !b || a === b) continue;
      const [x, y] = [a, b].sort();
      const key = `${x}|${y}`;
      const pair = pairs.get(key) ?? { a: x as Department, b: y as Department, count: 0 };
      pair.count += 1;
      pairs.set(key, pair);
    }
  }

  const links = [...pairs.values()].map(({ a, b, count }) => {
    const from = nodeOf.get(a)!;
    const to = nodeOf.get(b)!;
    // Punto de control empujado hacia fuera del círculo: la curva no cruza el centro.
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    let dx = mid.x - center.x;
    let dy = mid.y - center.y;
    let length = Math.hypot(dx, dy);
    if (length < 1) {
      // Departamentos opuestos: el punto medio cae en el centro; se usa la perpendicular.
      dx = -(to.y - from.y);
      dy = to.x - from.x;
      length = Math.hypot(dx, dy);
    }
    const control = { x: center.x + (dx / length) * ring * 1.35, y: center.y + (dy / length) * ring * 1.35 };
    const badge = { x: (from.x + 2 * control.x + to.x) / 4, y: (from.y + 2 * control.y + to.y) / 4 };
    return { a, b, count, from: { x: from.x, y: from.y }, control, to: { x: to.x, y: to.y }, badge };
  });

  return {
    width,
    height,
    center: { ...center, done: all.filter((t) => t.status === "done").length, total: all.length },
    departments: nodes,
    links,
  };
}

export function areasFocus(view: PlanView, department: Department): AreasFocus {
  const { width, height, objectiveRadius, taskRadius, topGap, pillWidth, maxLabels } = AREAS_LAYERS;
  const center = { x: width / 2, y: height / 2 + 30 };
  const at = (angle: number, r: number) => ({ x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r });
  const all = planTasks(view);
  const departmentOf = (line: number) => view.lines[line]?.department;
  const own = all.filter((t) => departmentOf(t.line) === department);
  const ownIds = new Set(own.map((t) => t.id));

  const others = departmentsOf(view).filter((d) => d !== department);
  const pills = others.map((d, i) => {
    const tasks = all.filter((t) => departmentOf(t.line) === d);
    return {
      department: d,
      x: 190 + i * (pillWidth + 12) + pillWidth / 2,
      y: 32,
      width: pillWidth,
      done: tasks.filter((t) => t.status === "done").length,
      total: tasks.length,
    };
  });

  // Arco disponible: todo el círculo menos un hueco arriba; cada objetivo, en proporción a sus tareas.
  const lines = view.lines.flatMap((line, index) => (line.department === department ? [index] : []));
  const arc = 2 * Math.PI - topGap;
  let start = -Math.PI / 2 + topGap / 2;
  const objectives: AreasFocus["objectives"] = [];
  const tasks: AreasFocus["tasks"] = [];
  const showLabels = own.length <= maxLabels;

  for (const line of lines) {
    const lineTasks = own.filter((t) => t.line === line);
    if (lineTasks.length === 0) continue;
    const span = (arc * lineTasks.length) / own.length;
    const angle = start + span / 2;
    const point = at(angle, objectiveRadius);
    objectives.push({ line, goal: view.lines[line].goal, angle, right: Math.cos(angle) >= 0, ...point });
    lineTasks.forEach((task, k) => {
      const taskAngle = start + (span * (k + 0.5)) / lineTasks.length;
      const spot = at(taskAngle, taskRadius);
      tasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        line,
        right: Math.cos(taskAngle) >= 0,
        label: showLabels,
        from: point,
        ...spot,
      });
    });
    start += span;
  }

  const spotOf = new Map(tasks.map((t) => [t.id, t]));
  const inner: AreasFocus["inner"] = [];
  const outerCount = new Map<Department, number>();
  for (const task of all) {
    for (const dependency of task.dependsOn) {
      const inA = ownIds.has(dependency);
      const inB = ownIds.has(task.id);
      if (inA && inB) {
        const a = spotOf.get(dependency)!;
        const b = spotOf.get(task.id)!;
        inner.push({ from: dependency, to: task.id, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
      } else if (inA || inB) {
        const other = inA ? task : all.find((t) => t.id === dependency);
        const d = other ? departmentOf(other.line) : undefined;
        if (d && d !== department) outerCount.set(d, (outerCount.get(d) ?? 0) + 1);
      }
    }
  }

  const outer = pills.flatMap((pill) => {
    const count = outerCount.get(pill.department);
    if (!count) return [];
    const angle = Math.atan2(pill.y - center.y, pill.x - center.x);
    return [{ department: pill.department, count, from: at(angle, 60), to: { x: pill.x, y: pill.y + 14 } }];
  });

  return {
    width,
    height,
    center: { ...center, department, done: own.filter((t) => t.status === "done").length, total: own.length },
    pills,
    objectives,
    tasks,
    inner,
    outer,
  };
}