import type { Department } from "./line.ts";
import type { TaskStatus } from "./task.ts";
import type { DoneTaskView, PlanView } from "./view.ts";

/**
 * Vista Áreas en rueda: todas las áreas alrededor del plan (con señales de "ahora" y "esperando")
 * o un área enfocada, abierta en árbol hacia la derecha (objetivos → tareas). Solo calcula posiciones:
 * el giro de la rueda lo anima el componente.
 */

export const AREAS_WHEEL = {
  width: 1200,
  height: 700,
  ring: 220,
  minNode: 22,
  nodePerSqrt: 10,
  /** Con un área enfocada, el centro del plan queda cortado por el borde izquierdo. */
  focusCenterX: 40,
  objectiveOffset: 190,
  taskOffset: 420,
  rowHeight: 50,
  /** Margen arriba y abajo del árbol cuando no cabe en la altura base. */
  treeMargin: 100,
} as const;

type Point = { x: number; y: number };
export type AreaCounts = { done: number; doing: number; waiting: number; todo: number };

export interface AreaSignal {
  department: Department;
  done: number;
  total: number;
  /** Tareas del área que están en "Ahora". */
  now: number;
  /** Tareas que esperan a un tercero o están bloqueadas por algo pendiente. */
  waiting: number;
}

export interface AreasWheel {
  width: number;
  height: number;
  center: Point & { done: number; total: number };
  /** angle en radianes (0 = a la derecha del centro); el componente gira la rueda hasta dejarlo en 0. */
  departments: (Point & AreaSignal & { angle: number; r: number })[];
}

export interface TreeBlocker {
  department: Department;
  taskId: string;
  title: string;
}

export interface AreasTree {
  width: number;
  height: number;
  /** Centro del plan (cortado por el borde) y nodo del área, ya a la derecha del centro. */
  center: Point;
  node: Point & { department: Department; r: number; done: number; total: number; counts: AreaCounts };
  objectives: (Point & { line: number; goal: string; done: number; total: number })[];
  tasks: (Point & {
    id: string;
    title: string;
    status: TaskStatus;
    line: number;
    /** Punto del objetivo del que cuelga. */
    from: Point;
    /** Posición en "Ahora" (1, 2, 3) o null. */
    now: number | null;
    /** Tareas pendientes de otras áreas de las que depende. */
    blockedBy: TreeBlocker[];
  })[];
  /** Todas las áreas, para el riel. */
  rail: AreaSignal[];
}

const countsOf = (tasks: readonly DoneTaskView[]): AreaCounts => ({
  done: tasks.filter((t) => t.status === "done").length,
  doing: tasks.filter((t) => t.status === "doing").length,
  waiting: tasks.filter((t) => t.status === "waiting").length,
  todo: tasks.filter((t) => t.status === "todo" || t.status === "blocked").length,
});

const nodeRadius = (total: number) => AREAS_WHEEL.minNode + Math.sqrt(total) * AREAS_WHEEL.nodePerSqrt;

function context(view: PlanView) {
  const all = view.phases.flatMap((group) => [...group.tasks, ...group.done]);
  const departmentOf = (task: DoneTaskView) => view.lines[task.line]?.department;
  const departments = [...new Set(view.lines.map((line) => line.department))];
  const nowOf = new Map(view.now.map((item, i) => [item.taskId, i + 1]));
  const signal = (department: Department): AreaSignal => {
    const own = all.filter((t) => departmentOf(t) === department);
    return {
      department,
      done: own.filter((t) => t.status === "done").length,
      total: own.length,
      now: own.filter((t) => nowOf.has(t.id)).length,
      waiting: own.filter((t) => t.status === "waiting" || t.status === "blocked").length,
    };
  };
  return { all, departmentOf, departments, nowOf, signal };
}

export function areasWheel(view: PlanView): AreasWheel {
  const { width, height, ring } = AREAS_WHEEL;
  const center = { x: width / 2, y: height / 2 };
  const { all, departments, signal } = context(view);
  return {
    width,
    height,
    center: { ...center, done: all.filter((t) => t.status === "done").length, total: all.length },
    departments: departments.map((department, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / departments.length;
      const s = signal(department);
      return { ...s, angle, r: nodeRadius(s.total), x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring };
    }),
  };
}

export function areasTree(view: PlanView, department: Department): AreasTree {
  const { width, ring, focusCenterX, objectiveOffset, taskOffset, rowHeight, treeMargin } = AREAS_WHEEL;
  const { all, departmentOf, departments, nowOf, signal } = context(view);
  const own = all.filter((t) => departmentOf(t) === department);
  const byId = new Map(all.map((t) => [t.id, t]));

  // Si el árbol no cabe en la altura base, el lienzo crece y todo se centra en él.
  const height = Math.max(AREAS_WHEEL.height, own.length * rowHeight + 2 * treeMargin);
  const center = { x: focusCenterX, y: height / 2 };
  const node = { x: center.x + ring, y: center.y };
  const top = node.y - ((own.length - 1) * rowHeight) / 2;

  const lines = view.lines.flatMap((line, index) => (line.department === department ? [index] : []));
  const objectives: AreasTree["objectives"] = [];
  const tasks: AreasTree["tasks"] = [];
  let row = 0;
  for (const line of lines) {
    const lineTasks = own.filter((t) => t.line === line);
    if (lineTasks.length === 0) continue;
    const objective = { x: node.x + objectiveOffset, y: top + (row + (lineTasks.length - 1) / 2) * rowHeight };
    objectives.push({
      line,
      goal: view.lines[line].goal,
      done: lineTasks.filter((t) => t.status === "done").length,
      total: lineTasks.length,
      ...objective,
    });
    for (const task of lineTasks) {
      // Solo bloqueos pendientes que vienen de otra área; los de la propia área se ven en el árbol.
      const blockedBy =
        task.status === "done"
          ? []
          : task.dependsOn.flatMap((id) => {
              const other = byId.get(id);
              const d = other ? departmentOf(other) : undefined;
              return other && d && d !== department && other.status !== "done" ? [{ department: d, taskId: other.id, title: other.title }] : [];
            });
      tasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        line,
        from: objective,
        now: nowOf.get(task.id) ?? null,
        blockedBy,
        x: node.x + taskOffset,
        y: top + row * rowHeight,
      });
      row += 1;
    }
  }

  return {
    width,
    height,
    center,
    node: { ...node, department, r: nodeRadius(own.length), done: own.filter((t) => t.status === "done").length, total: own.length, counts: countsOf(own) },
    objectives,
    tasks,
    rail: departments.map(signal),
  };
}