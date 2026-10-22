import type { Language } from "../report/narrative.ts";
import type { DELEGATION } from "./config.ts";
import type { Department } from "./line.ts";
import type { MoneyStatus } from "./orchestrator.ts";
import type { Actor, PROFESSIONALS } from "./step.ts";
import type { PHASES } from "./task.ts";
import type { DeadlineStatus } from "./timeline.ts";

/** Textos de la pantalla del plan (el contenido del plan viene del catálogo, ya en ES/EN). */
export interface PlanTexts {
  title: string;
  opening: string;
  weeks: string;
  estimated: string;
  steps: string;
  wait: string;
  decisions: string;
  provisional: string;
  money: Record<MoneyStatus, string>;
  deadline: Record<DeadlineStatus, string>;
  phase: Record<(typeof PHASES)[number], string>;
  department: Record<Department, string>;
  actor: Record<Actor, string>;
  adjust: string;
  startDate: string;
  hours: string;
  delegation: string;
  delegationOption: Record<(typeof DELEGATION)[number], string>;
  professionals: string;
  professional: Record<(typeof PROFESSIONALS)[number], string>;
  validationLevel: string;
  launchLevel: string;
  levels: [string, string, string];
  save: string;
  saving: string;
  create: string;
  creating: string;
  createIntro: string;
  notApproved: string;
  backToReport: string;
  generate: string;
  regenerate: string;
  generating: string;
  personalized: string;
  questionsIntro: string;
  unknown: string;
  other: string;
  otherLabel: string;
  answer: string;
  generateError: Record<"stale" | "unavailable" | "kept" | "not_allowed" | "invalid", string>;
  now: string;
  nowEmpty: string;
  nextStep: string;
  waitingFor: string;
  thirdParty: Record<"advisor" | "lawyer" | "designer" | "developer" | "public_body" | "supplier" | "bank" | "other", string>;
  after: string;
  blockedBy: string;
  outOfOrder: string;
  doneGroup: string;
  status: Record<"todo" | "ai_draft" | "requested" | "received" | "done" | "skipped", string>;
  action: Record<"done" | "skipped" | "requested" | "received" | "todo", string>;
  progressError: Record<"stale" | "invalid" | "failed", string>;
  overview: {
    money: string;
    deadline: string;
    tasksDone: string;
    views: { phases: string; areas: string; timeline: string };
    viewsLabel: string;
    soon: string;
    phaseDone: string;
    groupTitle: string;
    openTask: string;
    hint: string;
    weekShort: string;
    objectiveOne: string;
    allAreas: string;
    tabTask: string;
    tabDecisions: string;
    inspectorLabel: string;
    pickTask: string;
    areasHint: string;
    objectiveMany: string;
    today: string;
    openingBand: string;
    sure: string;
    estimatedRange: string;
    taskStatus: Record<"done" | "doing" | "waiting" | "todo" | "blocked", string>;
  };
  /** Solo textos (sin funciones): t se pasa a componentes de cliente. Las plantillas se rellenan con fillText. */
  task: {
    position: string;
    previous: string;
    next: string;
    progress: string;
    yourHours: string;
    draftOne: string;
    draftMany: string;
    aiStepOne: string;
    aiStepMany: string;
    days: string;
    waitDays: string;
    now: string;
    doneWhen: string;
    who: { user: string; ai: string };
    whoThird: string;
    yourTime: string;
    cost: string;
    waitLabel: string;
    where: string;
    before: string;
    unlocks: string;
    thisTask: string;
    alternative: string;
    allDone: string;
  };
}

export const PLAN_TEXTS: Record<Language, PlanTexts> = {
  es: {
    title: "Tu plan",
    opening: "Abres",
    weeks: "semanas",
    estimated: "estimado",
    steps: "Pasos",
    wait: "espera",
    decisions: "Decisiones pendientes",
    provisional: "provisional",
    money: {
      fits: "Tu presupuesto cubre el arranque y el plan.",
      at_risk: "Tu presupuesto puede quedarse corto.",
      over: "Tu presupuesto no llega para arrancar.",
    },
    deadline: {
      on_track: "Llegas a tu fecha límite.",
      at_risk: "Puede que no llegues a tu fecha límite.",
      late: "No llegas a tu fecha límite.",
    },
    phase: { validate: "Validar", prepare: "Preparar", launch: "Lanzar", operate: "Operar" },
    department: {
      founder: "Tú",
      product: "Producto",
      sales: "Comercial y marketing",
      finance: "Finanzas",
      legal: "Legal",
      operations: "Operaciones",
      team: "Equipo",
    },
    actor: { user: "tú", ai: "IA", third_party: "tercero" },
    adjust: "Ajustar",
    startDate: "Fecha de inicio",
    hours: "Horas por semana",
    delegation: "Cómo repartir el trabajo",
    delegationOption: { self: "Lo hago yo", ai: "Que la IA me prepare borradores", third_party: "Delegar en profesionales" },
    professionals: "Profesionales con los que cuentas",
    professional: { advisor: "Gestor o asesor", lawyer: "Abogado", designer: "Diseñador", developer: "Programador" },
    validationLevel: "Cuánto validar antes de invertir",
    launchLevel: "Cómo lanzar",
    levels: ["Lo justo / mínimo", "Equilibrado", "A fondo / completo"],
    save: "Guardar cambios",
    saving: "Guardando…",
    create: "Crear mi plan",
    creating: "Creando…",
    createIntro: "Tu plan sale de tu informe aprobado. Podrás ajustarlo después.",
    notApproved: "Aprueba tu informe para crear el plan.",
    backToReport: "Volver al informe",
    generate: "Personalizar con IA",
    regenerate: "Volver a generar",
    generating: "Generando… puede tardar hasta un minuto",
    personalized: "Personalizada",
    questionsIntro: "Antes de personalizarla, cuéntanos:",
    unknown: "Aún no lo sé",
    other: "Otra",
    otherLabel: "Tu respuesta",
    answer: "Responder y personalizar",
    generateError: {
      stale: "Este plan ha cambiado. Recarga la página.",
      unavailable: "La IA no está disponible ahora. Inténtalo en unos minutos.",
      kept: "No hemos podido personalizar esta tarea; se queda como estaba.",
      not_allowed: "Esta tarea ya no se puede personalizar.",
      invalid: "Responde a todas las preguntas.",
    },
    now: "Ahora",
    nowEmpty: "No hay nada que puedas empezar ahora.",
    nextStep: "Siguiente",
    waitingFor: "Esperando a",
    thirdParty: {
      advisor: "tu gestor o asesor",
      lawyer: "tu abogado",
      designer: "tu diseñador",
      developer: "tu programador",
      public_body: "la administración",
      supplier: "tu proveedor",
      bank: "el banco",
      other: "un tercero",
    },
    after: "Después de",
    blockedBy: "Antes conviene",
    outOfOrder: "Fuera de orden",
    doneGroup: "Hechas",
    status: { todo: "Pendiente", ai_draft: "Borrador", requested: "Pedido", received: "Recibido", done: "Hecho", skipped: "Saltado" },
    action: { done: "Hecho", skipped: "Saltar", requested: "Pedido", received: "Recibido", todo: "Reabrir" },
    task: {
      position: "{index} de {total}",
      previous: "Anterior",
      next: "Siguiente",
      progress: "{done} de {total}",
      yourHours: "tuyas",
      draftOne: "1 borrador por validar",
      draftMany: "{n} borradores por validar",
      aiStepOne: "1 paso de la IA",
      aiStepMany: "{n} pasos de la IA",
      days: "días",
      waitDays: "de espera",
      now: "Ahora",
      doneWhen: "Está hecho cuando",
      who: { user: "Lo haces tú", ai: "Lo prepara la IA, lo validas tú" },
      whoThird: "Lo hace {who}",
      yourTime: "Tu tiempo",
      cost: "Coste",
      waitLabel: "Espera",
      where: "Dónde encaja",
      before: "Antes",
      unlocks: "Desbloquea",
      thisTask: "Esta tarea",
      alternative: "Camino alternativo",
      allDone: "Tarea terminada",
    },
    overview: {
      money: "Dinero",
      deadline: "Fecha límite",
      tasksDone: "{done} de {total} tareas",
      views: { phases: "Fases", areas: "Áreas", timeline: "Cronograma" },
      viewsLabel: "Vistas del plan",
      soon: "Próximamente",
      phaseDone: "{done}/{total} hechas",
      groupTitle: "{n} tareas en {phase}",
      openTask: "Abrir tarea",
      hint: "Pasa el ratón por una estación para ver su tarea.",
      weekShort: "S",
      objectiveOne: "1 objetivo",
      allAreas: "Todas las áreas",
      tabTask: "Tarea",
      tabDecisions: "Decisiones",
      inspectorLabel: "Panel del plan",
      pickTask: "Pulsa una tarea en el mapa para verla aquí.",
      areasHint: "Pulsa un área para verla en detalle",
      objectiveMany: "{n} objetivos",      weekShort: "S",
      today: "HOY",
      openingBand: "Apertura",
      sure: "seguro",
      estimatedRange: "rango estimado",
      taskStatus: {
        done: "Hecha",
        doing: "En curso",
        waiting: "Esperando a un tercero",
        todo: "Por hacer",
        blocked: "Esperando a otra tarea",
      },
    },
    progressError: {
      stale: "Este plan ha cambiado. Recarga la página.",
      invalid: "Ese cambio ya no se puede hacer. Recarga la página.",
      failed: "No se ha podido guardar. Inténtalo de nuevo.",
    },
  },
  en: {
    title: "Your plan",
    opening: "You open",
    weeks: "weeks",
    estimated: "estimated",
    steps: "Steps",
    wait: "wait",
    decisions: "Pending decisions",
    provisional: "provisional",
    money: {
      fits: "Your budget covers the start and the plan.",
      at_risk: "Your budget may fall short.",
      over: "Your budget is not enough to start.",
    },
    deadline: {
      on_track: "You meet your deadline.",
      at_risk: "You may miss your deadline.",
      late: "You miss your deadline.",
    },
    phase: { validate: "Validate", prepare: "Prepare", launch: "Launch", operate: "Operate" },
    department: {
      founder: "You",
      product: "Product",
      sales: "Sales and marketing",
      finance: "Finance",
      legal: "Legal",
      operations: "Operations",
      team: "Team",
    },
    actor: { user: "you", ai: "AI", third_party: "third party" },
    adjust: "Adjust",
    startDate: "Start date",
    hours: "Hours per week",
    delegation: "How to share the work",
    delegationOption: { self: "I do it myself", ai: "AI prepares drafts", third_party: "Delegate to professionals" },
    professionals: "Professionals you can count on",
    professional: { advisor: "Accountant or advisor", lawyer: "Lawyer", designer: "Designer", developer: "Developer" },
    validationLevel: "How much to validate before investing",
    launchLevel: "How to launch",
    levels: ["Just enough / minimal", "Balanced", "Thorough / complete"],
    save: "Save changes",
    saving: "Saving…",
    create: "Create my plan",
    creating: "Creating…",
    createIntro: "Your plan comes from your approved report. You can adjust it later.",
    notApproved: "Approve your report to create the plan.",
    backToReport: "Back to the report",
    generate: "Personalize with AI",
    regenerate: "Generate again",
    generating: "Generating… it can take up to a minute",
    personalized: "Personalized",
    questionsIntro: "Before personalizing it, tell us:",
    unknown: "I don't know yet",
    other: "Other",
    otherLabel: "Your answer",
    answer: "Answer and personalize",
    generateError: {
      stale: "This plan has changed. Reload the page.",
      unavailable: "The AI is not available right now. Try again in a few minutes.",
      kept: "We couldn't personalize this task; it stays as it was.",
      not_allowed: "This task can no longer be personalized.",
      invalid: "Answer every question.",
    },
    now: "Now",
    nowEmpty: "There is nothing you can start right now.",
    nextStep: "Next",
    waitingFor: "Waiting for",
    thirdParty: {
      advisor: "your accountant or advisor",
      lawyer: "your lawyer",
      designer: "your designer",
      developer: "your developer",
      public_body: "the authorities",
      supplier: "your supplier",
      bank: "the bank",
      other: "a third party",
    },
    after: "After",
    blockedBy: "Better first",
    outOfOrder: "Out of order",
    doneGroup: "Done",
    status: { todo: "To do", ai_draft: "Draft", requested: "Requested", received: "Received", done: "Done", skipped: "Skipped" },
    action: { done: "Done", skipped: "Skip", requested: "Requested", received: "Received", todo: "Reopen" },
    task: {
      position: "{index} of {total}",
      previous: "Previous",
      next: "Next",
      progress: "{done} of {total}",
      yourHours: "yours",
      draftOne: "1 draft to review",
      draftMany: "{n} drafts to review",
      aiStepOne: "1 AI step",
      aiStepMany: "{n} AI steps",
      days: "days",
      waitDays: "of waiting",
      now: "Now",
      doneWhen: "Done when",
      who: { user: "You do it", ai: "The AI drafts it, you validate it" },
      whoThird: "Done by {who}",
      yourTime: "Your time",
      cost: "Cost",
      waitLabel: "Wait",
      where: "Where it fits",
      before: "Before",
      unlocks: "Unlocks",
      thisTask: "This task",
      alternative: "Alternative path",
      allDone: "Task finished",
    },
    overview: {
      money: "Money",
      deadline: "Deadline",
      tasksDone: "{done} of {total} tasks",
      views: { phases: "Phases", areas: "Areas", timeline: "Timeline" },
      viewsLabel: "Plan views",
      soon: "Coming soon",
      phaseDone: "{done}/{total} done",
      groupTitle: "{n} tasks in {phase}",
      openTask: "Open task",
      hint: "Hover over a station to see its task.",
      weekShort: "W",
      objectiveOne: "1 goal",
      allAreas: "All areas",
      tabTask: "Task",
      tabDecisions: "Decisions",
      inspectorLabel: "Plan panel",
      pickTask: "Click a task on the map to see it here.",
      areasHint: "Click an area to see it in detail",
      objectiveMany: "{n} goals",
      today: "TODAY",
      openingBand: "Opening",
      sure: "certain",
      estimatedRange: "estimated range",
      taskStatus: {
        done: "Done",
        doing: "In progress",
        waiting: "Waiting for a third party",
        todo: "To do",
        blocked: "Waiting for another task",
      },
    },
    progressError: {
      stale: "This plan has changed. Reload the page.",
      invalid: "That change is no longer possible. Reload the page.",
      failed: "It could not be saved. Try again.",
    },
  },
};

/** Rellena una plantilla: fillText("{done} de {total}", { done: 1, total: 4 }) → "1 de 4". */
export function fillText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}