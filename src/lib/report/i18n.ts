import type { AreaKey } from "./areas.ts";
import type { Language } from "./narrative.ts";
import type { Verdict } from "./verdict.ts";
import type { FooterState } from "./view.ts";
import type { ContradictionId } from "./contradictions.ts";

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
  continueAnyway: string;
  approved: string;
  reopen: string;
  contradictionsTitle: string;
  contradiction: Record<ContradictionId, string>;
  includesEstimate: string;
  approveError: Record<"stale" | "contradictions" | "failed", string>;
  dataTitle: string;
  fromYou: string;
  perMonth: string;
  field: Record<string, string>;
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
  continueAnyway: "Continuar igualmente",
  approved: "Aprobado · listo para planificar",
  reopen: "Reabrir",
  contradictionsTitle: "Hay datos que se contradicen",
  contradiction: {
    online_with_premises: "El negocio es solo online, pero tiene local o alquiler.",
    commission_without_money: "Cobras comisión por transacción, pero no manejas dinero de terceros.",
    marketplace_with_own_offer: "Es un marketplace de dos partes, pero ofreces un local o un producto propio.",
  },
  includesEstimate: "Incluye un dato estimado: puedes corregirlo o retirarlo.",
  approveError: {
    stale: "El informe ha cambiado. Recarga la página.",
    contradictions: "Corrige los datos que se contradicen antes de aprobar.",
    failed: "No se ha podido completar. Inténtalo de nuevo.",
  },
  dataTitle: "Datos de esta área",
  fromYou: "Tú",
  perMonth: "/mes",
  field: {
    sector: "Sector",
    offering_type: "Qué ofreces",
    revenue_model: "Cómo ganas dinero",
    differentiator: "Qué te diferencia",
    customer_segment: "Cliente",
    geographic_scope: "Alcance",
    acquisition_channel: "Canal de captación",
    competition: "Competencia",
    validation_stage: "Fase",
    budget_band: "Tramo de presupuesto",
    budget_eur: "Presupuesto",
    capital_intensity: "Necesidad de capital",
    startup_cost_eur: "Coste de arranque",
    monthly_fixed_costs_eur: "Gastos fijos",
    time_to_revenue: "Primeros ingresos",
    founder_experience: "Experiencia",
    founder_profile: "Perfil",
    time_commitment: "Dedicación",
    launch_timeline: "Plazo de lanzamiento",
    monthly_rent_eur: "Alquiler",
    rent_level: "Nivel de alquiler",
    regulatory_load: "Regulación",
    money_handling: "Dinero de terceros",
    team_requirement: "Equipo",
    third_party_dependency: "Dependencia de terceros",
  },
  footer: {
    all_good: "Pasar a planificación",
    risks: "Revisar riesgos antes de planificar",
    missing_data: "Completar datos para evaluar",
    contradictions: "Corregir datos",
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
  continueAnyway: "Continue anyway",
  approved: "Approved · ready to plan",
  reopen: "Reopen",
  contradictionsTitle: "Some data contradict each other",
  contradiction: {
    online_with_premises: "The business is online only, but it has premises or rent.",
    commission_without_money: "You charge a transaction commission, but you don't handle other people's money.",
    marketplace_with_own_offer: "It is a two-sided marketplace, but you offer your own premises or product.",
  },
  includesEstimate: "It includes an estimated value: you can correct or remove it.",
  approveError: {
    stale: "The report has changed. Reload the page.",
    contradictions: "Fix the contradicting data before approving.",
    failed: "It could not be completed. Please try again.",
  },
  dataTitle: "Data for this area",
  fromYou: "From you",
  perMonth: "/month",
  field: {
    sector: "Sector",
    offering_type: "What you offer",
    revenue_model: "How you make money",
    differentiator: "What sets you apart",
    customer_segment: "Customer",
    geographic_scope: "Scope",
    acquisition_channel: "Acquisition channel",
    competition: "Competition",
    validation_stage: "Stage",
    budget_band: "Budget range",
    budget_eur: "Budget",
    capital_intensity: "Capital needs",
    startup_cost_eur: "Startup cost",
    monthly_fixed_costs_eur: "Fixed costs",
    time_to_revenue: "First revenue",
    founder_experience: "Experience",
    founder_profile: "Profile",
    time_commitment: "Time commitment",
    launch_timeline: "Launch timeline",
    monthly_rent_eur: "Rent",
    rent_level: "Rent level",
    regulatory_load: "Regulation",
    money_handling: "Third-party money",
    team_requirement: "Team",
    third_party_dependency: "Third-party dependency",
  },
  footer: {
    all_good: "Continue to planning",
    risks: "Review risks before planning",
    missing_data: "Add data to evaluate",
    contradictions: "Fix data",
  },
};

export function reportTexts(language: Language): ReportTexts {
  return language === "es" ? ES : EN;
}