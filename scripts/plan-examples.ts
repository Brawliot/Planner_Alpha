/**
 * Informes de ejemplo para los scripts del plan (plan:demo y plan:generate). No son tests ni
 * parte del producto. Las opciones son las del catálogo de src/lib/report/questions.ts; los datos
 * "user" citan un fragmento que aparece literalmente en la idea.
 */
import type { PlanConfig } from "../src/lib/plan/config.ts";
import { CALIBRATED_JEV_MODEL } from "../src/lib/report/certainty.ts";
import type { Fact } from "../src/lib/report/facts.ts";

const known = (key: string, value: unknown): Fact => ({
  key,
  value,
  source: { origin: "jev", model: CALIBRATED_JEV_MODEL, confidence: 0.95, from: "user" },
});
const user = (key: string, value: unknown): Fact => ({ key, value, source: { origin: "user", quote: String(value) } });
const estimated = (key: string, value: unknown): Fact => ({
  key,
  value,
  source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: CALIBRATED_JEV_MODEL } },
});

export interface Example {
  title: string;
  /** Lo que escribió el usuario: contexto para la IA y fuente de las citas literales. */
  idea: string;
  facts: Fact[];
  /** Lo que el informe no sabe y se pregunta en la configuración. */
  config: Partial<PlanConfig>;
}

export const EXAMPLES: Record<string, Example> = {
  cafe: {
    title: "Cafetería de especialidad (Ana)",
    idea:
      "Quiero abrir una cafetería de especialidad en mi barrio, con café de origen tostado por pequeños tostadores. " +
      "Llevo más de 8 años trabajando de barista y me dedicaría a tiempo completo. Tengo 10000 euros ahorrados. " +
      "Cerca hay pocas cafeterías de este tipo.",
    facts: [
      known("sector", "Hospitality/Food service"),
      known("offering_type", "Physical venue"),
      known("revenue_model", "One-time sale"),
      known("customer_segment", "Consumers"),
      known("regulatory_load", "Heavy (health, finance, food)"),
      known("validation_stage", "Idea only"),
      known("founder_experience", "Over 5 years"),
      known("time_commitment", "Full time"),
      known("competition", "Few competitors"),
      user("budget_eur", 10000),
      estimated("startup_cost_eur", { min: 20000, max: 30000 }),
    ],
    config: { employed: false, hasNetwork: null, launchLevel: 1 },
  },
  saas: {
    title: "SaaS para gestorías",
    idea:
      "Un software por suscripción para pequeñas gestorías que automatiza la recogida de facturas de sus clientes. " +
      "Soy programador, llevo 4 años en el sector y he hablado con varias gestorías que tienen el problema. " +
      "Le dedicaría unas 15 horas a la semana, porque sigo en mi trabajo. Tengo 15000 euros. " +
      "Hay muchas herramientas parecidas y vendería directamente a las gestorías.",
    facts: [
      known("sector", "Technology/SaaS"),
      known("offering_type", "Software"),
      known("revenue_model", "Subscription"),
      known("customer_segment", "Small businesses (1-50)"),
      known("acquisition_channel", "Direct sales"),
      known("validation_stage", "Problem validated"),
      known("founder_experience", "2-5 years"),
      known("founder_profile", "Technical"),
      known("time_commitment", "10-20 h/week"),
      known("competition", "Crowded market"),
      known("regulatory_load", "Moderate (licenses, data protection)"),
      user("budget_eur", 15000),
      estimated("startup_cost_eur", { min: 5000, max: 12000 }),
    ],
    config: { employed: true, hasNetwork: false },
  },
  tienda: {
    title: "Tienda online de cerámica artesanal",
    idea:
      "Quiero vender por internet la cerámica que hago yo misma: tazas, platos y jarrones. " +
      "Ya tengo un prototipo de tienda y algunas piezas fotografiadas. Hago cerámica desde hace un año, " +
      "le dedicaría unas 30 horas a la semana y empezaría con 6000 euros. Hay mucha competencia, " +
      "pero mis piezas son de calidad y únicas. Cobraría con una pasarela de pago y vendería sobre todo por Instagram.",
    facts: [
      known("sector", "Retail/Commerce"),
      known("offering_type", "Physical product"),
      known("revenue_model", "One-time sale"),
      known("customer_segment", "Consumers"),
      known("geographic_scope", "Online"),
      known("acquisition_channel", "Online self-service"),
      known("validation_stage", "Prototype"),
      known("founder_experience", "Under 2 years"),
      known("founder_profile", "Sector expert"),
      known("time_commitment", "20-40 h/week"),
      known("competition", "Crowded market"),
      known("differentiator", "Quality or experience"),
      known("capital_intensity", "Medium"),
      known("regulatory_load", "Light"),
      known("money_handling", "Collects through a payment provider"),
      known("third_party_dependency", "Depends on a platform"),
      user("budget_eur", 6000),
      estimated("startup_cost_eur", { min: 3000, max: 7000 }),
    ],
    config: { employed: true, hasNetwork: false },
  },
  clinica: {
    title: "Clínica de fisioterapia",
    idea:
      "Soy fisioterapeuta con 10 años de experiencia y quiero abrir mi propia clínica en mi ciudad. " +
      "Mis pacientes actuales me dicen que me seguirían. Necesitaría un local, la autorización sanitaria " +
      "y contratar a otro fisioterapeuta. Me dedicaría a tiempo completo y tengo 40000 euros. " +
      "En la zona hay pocas clínicas y la mayoría de pacientes llegan por recomendación.",
    facts: [
      known("sector", "Health/Medicine"),
      known("offering_type", "Physical venue"),
      known("revenue_model", "Services by hours or projects"),
      known("customer_segment", "Consumers"),
      known("geographic_scope", "Local"),
      known("acquisition_channel", "Community or word of mouth"),
      known("validation_stage", "Problem validated"),
      known("founder_experience", "Over 5 years"),
      known("founder_profile", "Sector expert"),
      known("time_commitment", "Full time"),
      known("competition", "Few competitors"),
      known("team_requirement", "Small team (2-3)"),
      known("regulatory_load", "Heavy (health, finance, food)"),
      user("budget_eur", 40000),
      estimated("startup_cost_eur", { min: 35000, max: 60000 }),
    ],
    config: { employed: true, hasNetwork: true },
  },
};