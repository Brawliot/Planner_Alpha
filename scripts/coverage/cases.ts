/**
 * Negocios de ejemplo para medir la cobertura del catálogo (plan:coverage). No son tests ni parte
 * del producto. Opciones de src/lib/report/questions.ts; los datos "user" citan un fragmento de la idea.
 */
import type { PlanConfig } from "../../src/lib/plan/config.ts";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { EXAMPLES } from "../plan-examples.ts";

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

export interface CoverageCase {
  title: string;
  idea: string;
  facts: Fact[];
  config: Partial<PlanConfig>;
}

export const CASES: Record<string, CoverageCase> = {
  ...EXAMPLES,
  ropa: {
    title: "Tienda online de ropa sostenible",
    idea:
      "Quiero vender por internet ropa de algodón orgánico que compraré a un fabricante portugués. " +
      "No tengo experiencia en moda y empezaría con 8000 euros, dedicándole 20 horas a la semana.",
    facts: [
      known("sector", "Retail/Commerce"),
      known("offering_type", "Physical product"),
      known("revenue_model", "One-time sale"),
      known("customer_segment", "Consumers"),
      known("geographic_scope", "Online"),
      known("acquisition_channel", "Online self-service"),
      known("validation_stage", "Idea only"),
      known("founder_experience", "None"),
      known("time_commitment", "10-20 h/week"),
      known("competition", "Crowded market"),
      known("capital_intensity", "Medium"),
      known("regulatory_load", "Light"),
      known("money_handling", "Collects through a payment provider"),
      user("budget_eur", 8000),
      estimated("startup_cost_eur", { min: 5000, max: 10000 }),
    ],
    config: { employed: true, hasNetwork: false },
  },
  panaderia: {
    title: "Panadería con obrador",
    idea:
      "Soy panadero desde hace 12 años y quiero abrir mi panadería con obrador propio en mi pueblo. " +
      "Necesitaré un local, hornos y una persona que me ayude. Tengo 30000 euros y me dedicaría a tiempo completo.",
    facts: [
      known("sector", "Hospitality/Food service"),
      known("offering_type", "Physical venue"),
      known("revenue_model", "One-time sale"),
      known("customer_segment", "Consumers"),
      known("geographic_scope", "Hyper-local"),
      known("acquisition_channel", "Foot traffic or location"),
      known("validation_stage", "Problem validated"),
      known("founder_experience", "Over 5 years"),
      known("founder_profile", "Sector expert"),
      known("time_commitment", "Full time"),
      known("competition", "Few competitors"),
      known("team_requirement", "Small team (2-3)"),
      known("capital_intensity", "High (inventory, equipment, premises or R&D)"),
      known("regulatory_load", "Heavy (health, finance, food)"),
      user("budget_eur", 30000),
      estimated("startup_cost_eur", { min: 40000, max: 70000 }),
    ],
    config: { employed: false, hasNetwork: true },
  },
  consultora: {
    title: "Consultora de marketing freelance",
    idea:
      "Llevo 6 años en una agencia de marketing y quiero trabajar por mi cuenta para pequeñas empresas, " +
      "cobrando por proyecto. Ya tengo dos clientes interesados. Empezaría con 3000 euros.",
    facts: [
      known("sector", "Marketing/Advertising/Agencies"),
      known("offering_type", "People-delivered service"),
      known("revenue_model", "Services by hours or projects"),
      known("customer_segment", "Small businesses (1-50)"),
      known("acquisition_channel", "Direct sales"),
      known("validation_stage", "MVP with customers"),
      known("founder_experience", "Over 5 years"),
      known("founder_profile", "Commercial"),
      known("time_commitment", "Full time"),
      known("competition", "Crowded market"),
      known("capital_intensity", "Low (digital, near-zero marginal cost)"),
      known("regulatory_load", "Light"),
      user("budget_eur", 3000),
      estimated("startup_cost_eur", { min: 1000, max: 3000 }),
    ],
    config: { employed: true, hasNetwork: true },
  },
  academia: {
    title: "Academia de idiomas",
    idea:
      "Quiero abrir una academia de inglés para niños en mi barrio, con cuotas mensuales. " +
      "Soy profesora desde hace 3 años y necesitaría un local con dos aulas. Tengo 20000 euros.",
    facts: [
      known("sector", "Education/Training"),
      known("offering_type", "Physical venue"),
      known("revenue_model", "Subscription"),
      known("customer_segment", "Consumers"),
      known("geographic_scope", "Local"),
      known("acquisition_channel", "Community or word of mouth"),
      known("validation_stage", "Idea only"),
      known("founder_experience", "2-5 years"),
      known("founder_profile", "Sector expert"),
      known("time_commitment", "Full time"),
      known("competition", "Few competitors"),
      known("team_requirement", "Small team (2-3)"),
      known("regulatory_load", "Moderate (licenses, data protection)"),
      user("budget_eur", 20000),
      estimated("startup_cost_eur", { min: 15000, max: 30000 }),
    ],
    config: { employed: false, hasNetwork: true },
  },
  cuidadores: {
    title: "Plataforma de cuidadores de mayores",
    idea:
      "Una web que pone en contacto a familias con cuidadores de personas mayores, cobrando una comisión " +
      "por cada servicio y guardando el pago hasta que termina. Soy enfermera y tengo 25000 euros.",
    facts: [
      known("sector", "Health/Medicine"),
      known("offering_type", "Platform or marketplace"),
      known("revenue_model", "Transaction commission"),
      known("customer_segment", "Two-sided marketplace"),
      known("geographic_scope", "Regional"),
      known("acquisition_channel", "Online self-service"),
      known("validation_stage", "Idea only"),
      known("founder_experience", "Over 5 years"),
      known("founder_profile", "Sector expert"),
      known("time_commitment", "20-40 h/week"),
      known("competition", "Few competitors"),
      known("regulatory_load", "Moderate (licenses, data protection)"),
      known("money_handling", "Holds or intermediates funds"),
      known("third_party_dependency", "Few key partners"),
      user("budget_eur", 25000),
      estimated("startup_cost_eur", { min: 20000, max: 50000 }),
    ],
    config: { employed: true, hasNetwork: true },
  },
  corporativo: {
    title: "Software para grandes empresas",
    idea:
      "Un software de cumplimiento normativo que venderíamos con licencia anual a grandes empresas. " +
      "Somos dos socios técnicos, con 2 años de experiencia, y tenemos 50000 euros.",
    facts: [
      known("sector", "Technology/SaaS"),
      known("offering_type", "Software"),
      known("revenue_model", "Licensing"),
      known("customer_segment", "Large businesses (250+)"),
      known("geographic_scope", "National"),
      known("acquisition_channel", "Direct sales"),
      known("validation_stage", "Prototype"),
      known("founder_experience", "2-5 years"),
      known("founder_profile", "Technical"),
      known("time_commitment", "Full time"),
      known("competition", "Dominated by large players"),
      known("team_requirement", "Specialized profiles required"),
      known("regulatory_load", "Moderate (licenses, data protection)"),
      user("budget_eur", 50000),
      estimated("startup_cost_eur", { min: 30000, max: 80000 }),
    ],
    config: { employed: false, hasNetwork: false, withPartners: true },
  },
  reformas: {
    title: "Empresa de reformas",
    idea:
      "Soy albañil con 15 años de experiencia y quiero montar mi empresa de reformas de pisos con un ayudante, " +
      "cobrando por obra. Tengo 12000 euros para la furgoneta y las herramientas.",
    facts: [
      known("sector", "Construction/Real Estate"),
      known("offering_type", "People-delivered service"),
      known("revenue_model", "Services by hours or projects"),
      known("customer_segment", "Consumers"),
      known("geographic_scope", "Local"),
      known("acquisition_channel", "Community or word of mouth"),
      known("validation_stage", "Generating revenue"),
      known("founder_experience", "Over 5 years"),
      known("founder_profile", "Sector expert"),
      known("time_commitment", "Full time"),
      known("competition", "Crowded market"),
      known("team_requirement", "Small team (2-3)"),
      known("regulatory_load", "Moderate (licenses, data protection)"),
      user("budget_eur", 12000),
      estimated("startup_cost_eur", { min: 10000, max: 20000 }),
    ],
    config: { employed: true, hasNetwork: true },
  },
  aceite: {
    title: "Exportación de aceite de oliva",
    idea:
      "Mi familia produce aceite de oliva y quiero venderlo embotellado a tiendas gourmet de Alemania y Francia " +
      "a través de distribuidores. Tengo 18000 euros y le dedicaría 15 horas a la semana.",
    facts: [
      known("sector", "Agriculture/Livestock"),
      known("offering_type", "Physical product"),
      known("revenue_model", "One-time sale"),
      known("customer_segment", "Small businesses (1-50)"),
      known("geographic_scope", "International"),
      known("acquisition_channel", "Partners or channel"),
      known("validation_stage", "Problem validated"),
      known("founder_experience", "Under 2 years"),
      known("time_commitment", "10-20 h/week"),
      known("competition", "Crowded market"),
      known("capital_intensity", "Medium"),
      known("regulatory_load", "Heavy (health, finance, food)"),
      known("third_party_dependency", "Few key partners"),
      user("budget_eur", 18000),
      estimated("startup_cost_eur", { min: 10000, max: 25000 }),
    ],
    config: { employed: true, hasNetwork: false },
  },
};