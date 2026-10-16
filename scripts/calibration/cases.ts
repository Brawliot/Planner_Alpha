/**
 * Casos etiquetados para calibrar Jev. Las etiquetas (expected, label) las revisa una persona,
 * nunca un modelo: si no, mediríamos a Jev contra otra IA.
 * Cada caso va en inglés y en español para medir si el idioma cambia el acierto.
 */
import type { JevQuestion } from "../../src/lib/jev.ts";
import { BASE_QUESTIONS } from "../../src/lib/report/questions.ts";

export type Lang = "en" | "es";

// Las mismas preguntas que usa la app: los umbrales solo valen para este texto exacto.
export const CHOICE_QUESTIONS = BASE_QUESTIONS;

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

      // Casos difíciles: dos categorías defendibles o poca información.
  ...choicePair("rest-app", "sector", "Technology/SaaS",
    "An app that lets restaurants manage their table bookings",
    "Una app para que los restaurantes gestionen sus reservas"),
  ...choicePair("bookcafe", "sector", "Hospitality/Food service",
    "A café that also sells second-hand books",
    "Una cafetería que también vende libros de segunda mano"),
  ...choicePair("vet-online", "sector", "Health/Medicine",
    "Online video consultations with vets for pet owners",
    "Videoconsultas veterinarias online para dueños de mascotas"),
  ...choicePair("coworking", "sector", "Construction/Real Estate",
    "Renting desks in a coworking space I lease in Madrid",
    "Alquilar puestos en un coworking que tengo arrendado en Madrid"),
  ...choicePair("gym-course", "sector", "Education/Training",
    "Selling an online course on how to open a gym",
    "Vender un curso online sobre cómo abrir un gimnasio"),
  ...choicePair("insurance-broker", "sector", "Finance/Banking/Insurance",
    "A broker comparing car insurance for young drivers",
    "Un corredor que compara seguros de coche para conductores jóvenes"),
  ...choicePair("ecommerce-spain", "geographic_scope", "National",
    "An online shop shipping organic food anywhere in Spain",
    "Una tienda online que envía comida ecológica a toda España"),
  ...choicePair("food-truck", "geographic_scope", "Not specified",
    "A food truck selling burgers",
    "Un food truck de hamburguesas"),
  ...choicePair("beta-users", "validation_stage", "Prototype",
    "I built a first version of the app and five friends are testing it for free",
    "He hecho una primera versión de la app y la están probando gratis cinco amigos"),
  ...choicePair("surveys", "validation_stage", "Problem validated",
    "I surveyed 80 bar owners and most of them struggle with stock control; I have not built anything yet",
    "He encuestado a 80 dueños de bares y a la mayoría les cuesta controlar el stock; aún no he construido nada"),
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