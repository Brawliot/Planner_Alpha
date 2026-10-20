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
  plan: string; contradictionsTitle: string;
  summary: {
    open: string;
    aiBadge: string;
    partsLabel: string;
    tab: Record<"strengths" | "work" | "unknown" | "next", string>;
    heading: Record<"strengths" | "work" | "unknown" | "next", string>;
    counts: (strong: number, risk: number, unknown: number) => string;
    previous: string;
    next: string;
    toReport: string;
    close: string;
    footnote: string;
    unavailable: string;
    retry: string;
    writing: string;
    error: Record<"stale" | "failed", string>;
    generate: string;
    soon: string;
  };
  contradiction: Record<ContradictionId, string>;
  includesEstimate: string;
  approveError: Record<"stale" | "contradictions" | "failed", string>;
  dataTitle: string;
  pendingTitle: string;
  fromYou: string;
  perMonth: string;
  field: Record<string, string>;
  footer: Record<FooterState, string>;
}

const ES: ReportTexts = {
  title: "Informe de tu idea",
  yourIdea: "Tu idea",
  verdicts: "Veredictos",
  verdict: { strong: "A favor", risk: "A trabajar", needs_info: "Falta información" },
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
  mainRisks: "Lo que hay que trabajar",
  riskCount: (n) => (n === 1 ? "1 área" : `${n} áreas`),
  noRisks: "Nada a trabajar con lo que sabemos hasta ahora.",
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
  plan: "Mi plan",
  summary: {
    open: "Resumen ejecutivo",
    aiBadge: "Redactado por la IA",
    partsLabel: "Partes del resumen",
    tab: { strengths: "Lo sólido", work: "A trabajar", unknown: "Sin datos", next: "Siguiente paso" },
    heading: {
      strengths: "Lo más sólido",
      work: "Lo que hay que trabajar",
      unknown: "Lo que aún no sabemos",
      next: "Siguiente paso",
    },
    counts: (strong, risk, unknown) => `${strong} a favor · ${risk} a trabajar · ${unknown} sin datos`,
    previous: "Anterior",
    next: "Siguiente",
    toReport: "Ver el informe",
    close: "Cerrar",
    footnote:
      "Texto redactado por IA a partir de tu informe. Las cifras las calcula el código. Orientativo: no es asesoramiento financiero ni legal.",
    unavailable: "No hemos podido redactar el resumen.",
    retry: "Reintentar",
    writing: "Redactando tu resumen…",
    error: {
      stale: "Este informe ha cambiado. Recarga la página.",
      failed: "Seguimos sin poder redactarlo. Inténtalo en unos minutos.",
    },
    generate: "Generar informe",
    soon: "Próximamente",
  },
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
  pendingTitle: "Por concretar",
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
    risks: "Revisar lo que hay que trabajar",
    missing_data: "Completar datos para evaluar",
    contradictions: "Corregir datos",
  },
};

const EN: ReportTexts = {
  title: "Your idea report",
  yourIdea: "Your idea",
  verdicts: "Verdicts",
  verdict: { strong: "In your favour", risk: "Needs work", needs_info: "Needs info" },  assessmentByArea: "Assessment by area",
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
  mainRisks: "What needs work",
  riskCount: (n) => (n === 1 ? "1 area" : `${n} areas`),
  noRisks: "Nothing needs work with what we know so far.",
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
  plan: "My plan",
  summary: {
    open: "Executive summary",
    aiBadge: "Written by AI",
    partsLabel: "Summary sections",
    tab: { strengths: "Strengths", work: "Needs work", unknown: "Unknown", next: "Next step" },
    heading: {
      strengths: "What is most solid",
      work: "What needs work",
      unknown: "What we don't know yet",
      next: "Next step",
    },
    counts: (strong, risk, unknown) => `${strong} in your favour · ${risk} need work · ${unknown} without data`,
    previous: "Previous",
    next: "Next",
    toReport: "View the report",
    close: "Close",
    footnote: "Written by AI from your report. Figures are calculated by code. Indicative: not financial or legal advice.",
    unavailable: "We couldn't write your summary.",
    retry: "Try again",
    writing: "Writing your summary…",
    error: {
      stale: "This report has changed. Reload the page.",
      failed: "We still couldn't write it. Try again in a few minutes.",
    },
    generate: "Generate report",
    soon: "Coming soon",
  },
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
  pendingTitle: "Still to define",
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
    risks: "Review what needs work",
    missing_data: "Add data to evaluate",
    contradictions: "Fix data",
  },
};

export function reportTexts(language: Language): ReportTexts {
  return language === "es" ? ES : EN;
}