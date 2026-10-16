/**
 * Casos etiquetados para calibrar Jev. Las etiquetas (expected, label) las revisa una persona,
 * nunca un modelo: si no, mediríamos a Jev contra otra IA.
 * Cada caso va en inglés y en español para medir si el idioma cambia el acierto.
 */
import type { JevQuestion } from "../../src/lib/jev.ts";

export type Lang = "en" | "es";

type ChoiceQuestion = Extract<JevQuestion, { type: "choice" }>;

const ONLY_IF_SUPPORTED =
  'Choose an option only if user_text supports it; otherwise choose "Not specified".';

export const CHOICE_QUESTIONS = {
  sector: {
    type: "choice",
    instructions: "What is the business sector?",
    criteria: {
      "Technology/SaaS": "Software, apps, digital platforms or technology products",
      "Hospitality/Food service": "Restaurants, bars, cafes, hotels or catering",
      "Retail/Commerce": "Physical or online stores selling products to consumers",
      Manufacturing: "Industrial manufacturing or production of goods",
      "Professional Services": "Specialized services such as lawyers, architects or accounting firms",
      "Finance/Banking/Insurance": "Financial services, banking, investment or insurance",
      "Health/Medicine": "Clinics, healthcare services, pharmacy or medical wellness",
      "Education/Training": "Academies, courses, schools or training",
      "Logistics/Transport": "Transport of goods or people, warehousing or delivery",
      "Construction/Real Estate": "Building work, renovations, development, or buying, selling and renting property",
      "Marketing/Advertising/Agencies": "Marketing, advertising, communication or design agencies",
      "Media/Content/Entertainment": "Media outlets, content creation, leisure or events",
      "Agriculture/Livestock": "Crop growing, livestock or primary agri-food production",
      "Energy/Utilities": "Generation or supply of energy, water or other utilities",
      "Consulting/Advisory": "Strategic, business or technical advice to other companies",
      Other: "Does not fit any of the categories above",
    },
  },
  geographic_scope: {
    type: "choice",
    instructions: `What is the geographic scope of the business? ${ONLY_IF_SUPPORTED}`,
    criteria: {
      "Hyper-local": "A very specific neighborhood or area within a city",
      Local: "A city or municipality",
      Regional: "A province or autonomous community",
      National: "A whole country",
      International: "Several countries",
      Online: "Purely digital business with no physical geographic scope",
      "Not specified": "user_text does not say",
    },
  },
  validation_stage: {
    type: "choice",
    instructions: `How validated is the business? ${ONLY_IF_SUPPORTED}`,
    criteria: {
      "Idea only": "Concept without external validation",
      "Problem validated": "Confirmed that the problem exists",
      Prototype: "Working prototype or MVP developed",
      "MVP with customers": "Minimum viable product with early customers",
      "Generating revenue": "Currently making money from customers",
      Growing: "Revenue and user base are growing",
      "Not specified": "user_text does not say",
    },
  },
} satisfies Record<string, ChoiceQuestion>;

export type ChoiceQuestionKey = keyof typeof CHOICE_QUESTIONS;

export interface ChoiceCase {
  id: string;
  lang: Lang;
  question: ChoiceQuestionKey;
  text: string;
  expected: string;
}

function choicePair(id: string, question: ChoiceQuestionKey, expected: string, en: string, es: string): ChoiceCase[] {
  return [
    { id, lang: "en", question, text: en, expected },
    { id, lang: "es", question, text: es, expected },
  ];
}

export const CHOICE_CASES: ChoiceCase[] = [
  ...choicePair("bar", "sector", "Hospitality/Food service",
    "A neighborhood tapas bar in Madrid",
    "Un bar de tapas de barrio en Madrid"),
  ...choicePair("saas", "sector", "Technology/SaaS",
    "A SaaS tool that automates invoicing for freelancers",
    "Una herramienta SaaS que automatiza la facturación de los autónomos"),
  ...choicePair("dental", "sector", "Health/Medicine",
    "A dental clinic in Valencia",
    "Una clínica dental en Valencia"),
  ...choicePair("ceramics", "sector", "Retail/Commerce",
    "An online store selling handmade ceramics",
    "Una tienda online de cerámica hecha a mano"),
  ...choicePair("windows", "sector", "Manufacturing",
    "A small factory producing aluminium window frames",
    "Una pequeña fábrica de marcos de ventana de aluminio"),
  ...choicePair("parcels", "sector", "Logistics/Transport",
    "A last-mile parcel delivery service in Seville",
    "Un servicio de reparto de paquetería de última milla en Sevilla"),
  ...choicePair("academy", "sector", "Education/Training",
    "An academy that prepares students for civil service exams",
    "Una academia que prepara oposiciones"),
  ...choicePair("flats", "sector", "Construction/Real Estate",
    "Buying old flats, renovating them and reselling them",
    "Comprar pisos antiguos, reformarlos y revenderlos"),
  ...choicePair("olives", "sector", "Agriculture/Livestock",
    "An organic olive grove producing its own oil",
    "Un olivar ecológico que produce su propio aceite"),
  ...choicePair("solar", "sector", "Energy/Utilities",
    "A solar farm that sells electricity to the grid",
    "Una planta solar que vende electricidad a la red"),
  ...choicePair("agency", "sector", "Marketing/Advertising/Agencies",
    "A digital marketing agency for restaurants",
    "Una agencia de marketing digital para restaurantes"),
  ...choicePair("podcast", "sector", "Media/Content/Entertainment",
    "A network of football podcasts funded by ads",
    "Una red de pódcast de fútbol financiada con publicidad"),
  ...choicePair("bakery", "geographic_scope", "Hyper-local",
    "A bakery for the people of my street in Gràcia",
    "Una panadería para la gente de mi calle en Gràcia"),
  ...choicePair("taxi", "geographic_scope", "Local",
    "A taxi company operating in Zaragoza",
    "Una empresa de taxis que opera en Zaragoza"),
  ...choicePair("distributor", "geographic_scope", "Regional",
    "A drinks distributor covering all of Andalusia",
    "Una distribuidora de bebidas para toda Andalucía"),
  ...choicePair("trade", "geographic_scope", "International",
    "An import-export company trading between Spain, Morocco and Portugal",
    "Una empresa de importación y exportación entre España, Marruecos y Portugal"),
  ...choicePair("cheap", "geographic_scope", "Not specified",
    "A company that sells cheap things",
    "Una empresa que vende cosas baratas"),
  ...choicePair("vegan", "validation_stage", "Idea only",
    "I have an idea for a vegan bakery, nothing done yet",
    "Tengo la idea de una pastelería vegana, aún no he hecho nada"),
  ...choicePair("revenue", "validation_stage", "Generating revenue",
    "My invoicing app already has 40 paying customers",
    "Mi app de facturación ya tiene 40 clientes que pagan"),
  ...choicePair("coffee", "validation_stage", "Not specified",
    "A coffee shop",
    "Una cafetería"),
];

export type PlausibilityLabel = "plausible" | "implausible" | "borderline";

export interface NoulCase {
  id: string;
  lang: Lang;
  idea: string;
  assumption: { key: string; value: unknown };
  /** borderline no entra en el cálculo de umbrales: sirve para ver dónde cae lo dudoso. */
  label: PlausibilityLabel;
}

function noulPair(
  id: string,
  label: PlausibilityLabel,
  key: string,
  value: unknown,
  en: string,
  es: string,
): NoulCase[] {
  return [
    { id, lang: "en", idea: en, assumption: { key, value }, label },
    { id, lang: "es", idea: es, assumption: { key, value }, label },
  ];
}

const BAR_EN = "A tapas bar in Malasaña, Madrid, in an 80 m² premises";
const BAR_ES = "Un bar de tapas en Malasaña, Madrid, en un local de 80 m²";
const SAAS_EN = "A SaaS tool that automates invoicing for freelancers in Spain";
const SAAS_ES = "Una herramienta SaaS que automatiza la facturación de autónomos en España";
const DENTAL_EN = "A dental clinic with two chairs in Valencia";
const DENTAL_ES = "Una clínica dental con dos sillones en Valencia";
const BAKERY_EN = "A small neighbourhood bakery in Bilbao";
const BAKERY_ES = "Una panadería pequeña de barrio en Bilbao";

export const NOUL_CASES: NoulCase[] = [
  ...noulPair("bar-rent", "plausible", "monthly_rent_eur", { min: 3000, max: 6000 }, BAR_EN, BAR_ES),
  ...noulPair("bar-staff", "plausible", "staff_needed", { min: 3, max: 6 }, BAR_EN, BAR_ES),
  ...noulPair("bar-licence", "plausible", "needs_activity_licence", true, BAR_EN, BAR_ES),
  ...noulPair("saas-price", "plausible", "monthly_price_eur", { min: 10, max: 30 }, SAAS_EN, SAAS_ES),
  ...noulPair("saas-dev", "plausible", "months_to_first_version", { min: 3, max: 6 }, SAAS_EN, SAAS_ES),
  ...noulPair("dental-equipment", "plausible", "equipment_cost_eur", { min: 60000, max: 150000 }, DENTAL_EN, DENTAL_ES),
  ...noulPair("dental-permit", "plausible", "needs_health_authorisation", true, DENTAL_EN, DENTAL_ES),
  ...noulPair("bakery-oven", "plausible", "needs_professional_oven", true, BAKERY_EN, BAKERY_ES),
  ...noulPair("bar-rent-absurd", "implausible", "monthly_rent_eur", { min: 2, max: 5 }, BAR_EN, BAR_ES),
  ...noulPair("bar-staff-absurd", "implausible", "staff_needed", { min: 200, max: 300 }, BAR_EN, BAR_ES),
  ...noulPair("saas-price-absurd", "implausible", "monthly_price_eur", { min: 50000, max: 80000 }, SAAS_EN, SAAS_ES),
  ...noulPair("saas-dev-absurd", "implausible", "months_to_first_version", { min: 120, max: 180 }, SAAS_EN, SAAS_ES),
  ...noulPair("dental-permit-absurd", "implausible", "needs_health_authorisation", false, DENTAL_EN, DENTAL_ES),
  ...noulPair("dental-equipment-absurd", "implausible", "equipment_cost_eur", { min: 50, max: 200 }, DENTAL_EN, DENTAL_ES),
  ...noulPair("bakery-customers-absurd", "implausible", "daily_customers", { min: 500000, max: 1000000 }, BAKERY_EN, BAKERY_ES),
  ...noulPair("bakery-premises-absurd", "implausible", "premises_m2", { min: 20000, max: 50000 }, BAKERY_EN, BAKERY_ES),
  ...noulPair("bar-takeover", "borderline", "takeover_cost_eur", { min: 45000, max: 60000 }, BAR_EN, BAR_ES),
  ...noulPair("saas-customers", "borderline", "paying_customers_year_1", { min: 500, max: 1000 }, SAAS_EN, SAAS_ES),
  ...noulPair("dental-breakeven", "borderline", "months_to_break_even", { min: 12, max: 18 }, DENTAL_EN, DENTAL_ES),
  ...noulPair("bakery-revenue", "borderline", "monthly_revenue_eur", { min: 15000, max: 25000 }, BAKERY_EN, BAKERY_ES),
];

/** Plantilla fija de la pregunta de plausibilidad: la misma que usará la app. */
export const PLAUSIBILITY_QUESTION = {
  type: "noul",
  instructions:
    "Is the assumption in inferred_not_confirmed plausible for the business described in user_text? " +
    "Judge only whether it makes sense for this specific business; the user did not say it.",
  criteria: {
    true: "The assumption is realistic for this business",
    false: "The assumption is unrealistic or contradicts the business described",
  },
} satisfies JevQuestion;