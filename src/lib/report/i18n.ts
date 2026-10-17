import type { AreaKey } from "./areas.ts";
import type { Language } from "./narrative.ts";
import type { Verdict } from "./verdict.ts";
import type { FooterState } from "./view.ts";

/** Textos de la interfaz del informe, en el idioma del usuario. */
export interface ReportTexts {
  title: string;
  yourIdea: string;
  verdicts: string;
  verdict: Record<Verdict, string>;
  assessmentByArea: string;
  area: Record<AreaKey, string>;
  mainRisks: string;
  riskCount: (n: number) => string;
  noRisks: string;
  disclaimer: string;
  panelHelp: string;
  estimated: string;
  assumptions: string;
  noEstimates: string;
  showDetails: (area: string) => string;
  startOver: string;
  improveArea: (n: number) => string;
  save: string;
  saving: string;
  improveError: Record<"stale" | "invalid" | "failed", string>;
  editData: string;
  editTitle: string;
  editHelp: string;
  saveChanges: string;
  cancel: string;
  budgetExact: string;
  topic: Record<"business" | "market" | "founder" | "resources" | "location" | "risk", string>;
  editError: Record<"stale" | "invalid" | "inconsistent_budget" | "failed", string>;
  footer: Record<FooterState, string>;
}

const ES: ReportTexts = {
  title: "Informe de tu idea",
  yourIdea: "Tu idea",
  verdicts: "Veredictos",
  verdict: { strong: "Sólido", watch: "Vigilar", risk: "Riesgo", needs_info: "Faltan datos" },
  assessmentByArea: "Evaluación por área",
  area: {
    concept: "Concepto",
    validation: "Validación",
    market: "Mercado",
    competition: "Competencia",
    money: "Finanzas",
    founder: "Tú",
    location: "Ubicación",
    regulation: "Regulación",
    team: "Equipo",
    dependencies: "Dependencias",
  },
  mainRisks: "Riesgos principales",
  riskCount: (n) => (n === 1 ? "1 riesgo" : `${n} riesgos`),
  noRisks: "Aún no hay riesgos claros: faltan datos clave.",
  disclaimer: "Estimación orientativa, no es asesoramiento financiero ni legal.",
  panelHelp: "Pulsa la flecha de una tarjeta para ver su información aquí.",
  estimated: "estimado",
  assumptions: "Supuestos",
  noEstimates: "Sin estimaciones: valoración basada en lo que has escrito.",
  showDetails: (area) => `Mostrar detalle de ${area}`,
  startOver: "Empezar de nuevo",
  improveArea: (n) => `Mejorar esta área (${n})`,
  save: "Guardar",
  saving: "Guardando…",
  improveError: {
    stale: "Estas preguntas ya no están pendientes. Recarga la página.",
    invalid: "Responde todas las preguntas.",
    failed: "No se han podido guardar tus respuestas. Inténtalo de nuevo.",
  },
  editData: "Editar datos",
  editTitle: "Editar los datos del informe",
  editHelp: "Cambia lo que no sea correcto. Lo que no toques se queda como está.",
  saveChanges: "Guardar cambios",
  cancel: "Cancelar",
  budgetExact: "Presupuesto exacto en euros (opcional)",
  topic: {
    business: "Tu negocio",
    market: "Tu mercado",
    founder: "Tú",
    resources: "Recursos y plazos",
    location: "Ubicación",
    risk: "Riesgos",
  },
  editError: {
    stale: "Este informe ya no se puede editar. Recarga la página.",
    invalid: "Hay un valor no válido. Revisa el formulario.",
    inconsistent_budget: "El presupuesto exacto no cuadra con el tramo elegido.",
    failed: "No se han podido guardar los cambios. Inténtalo de nuevo.",
  },
  footer: {
    all_good: "Pasar a planificación",
    risks: "Revisar riesgos antes de planificar",
    missing_data: "Completar datos para evaluar",
  },
};

const EN: ReportTexts = {
  title: "Your idea report",
  yourIdea: "Your idea",
  verdicts: "Verdicts",
  verdict: { strong: "Strong", watch: "Watch", risk: "Risk", needs_info: "Needs info" },
  assessmentByArea: "Assessment by area",
  area: {
    concept: "Concept",
    validation: "Validation",
    market: "Market",
    competition: "Competition",
    money: "Money",
    founder: "You",
    location: "Location",
    regulation: "Regulation",
    team: "Team",
    dependencies: "Dependencies",
  },
  mainRisks: "Main risks",
  riskCount: (n) => (n === 1 ? "1 risk" : `${n} risks`),
  noRisks: "No clear risks yet: key data is missing.",
  disclaimer: "Indicative estimate only. It is not financial or legal advice.",
  panelHelp: "Press a card's arrow to see its information here.",
  estimated: "estimated",
  assumptions: "Assumptions",
  noEstimates: "No estimates: assessment based on what you wrote.",
  showDetails: (area) => `Show details for ${area}`,
  startOver: "Start over",
  improveArea: (n) => `Improve this area (${n})`,
  save: "Save",
  saving: "Saving…",
  improveError: {
    stale: "These questions are no longer pending. Reload the page.",
    invalid: "Answer all the questions.",
    failed: "Your answers could not be saved. Please try again.",
  },
  editData: "Edit data",
  editTitle: "Edit the report data",
  editHelp: "Change whatever is not right. Anything you don't touch stays as it is.",
  saveChanges: "Save changes",
  cancel: "Cancel",
  budgetExact: "Exact budget in euros (optional)",
  topic: {
    business: "Your business",
    market: "Your market",
    founder: "You",
    resources: "Resources and timing",
    location: "Location",
    risk: "Risks",
  },
  editError: {
    stale: "This report can no longer be edited. Reload the page.",
    invalid: "There is an invalid value. Please check the form.",
    inconsistent_budget: "The exact budget does not match the chosen range.",
    failed: "The changes could not be saved. Please try again.",
  },
  footer: {
    all_good: "Continue to planning",
    risks: "Review risks before planning",
    missing_data: "Add data to evaluate",
  },
};

export function reportTexts(language: Language): ReportTexts {
  return language === "es" ? ES : EN;
}