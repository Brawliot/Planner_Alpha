/**
 * Casos etiquetados para calibrar a Jev como juez del plan (src/lib/plan/judge.ts).
 * Las etiquetas (expected, label, tramos) LAS REVISA UNA PERSONA, nunca un modelo.
 * Cada caso va en inglés y en español. Coste: solo tasas y profesionales; la inversión
 * (local, obra, equipos, género) y los gastos mensuales cuentan como "free".
 */
import type { CostBand, EffortBand, WaitBand } from "../../src/lib/plan/bands.ts";
import type { Complexity } from "../../src/lib/plan/complexity.ts";
import type { Actor } from "../../src/lib/plan/step.ts";
import type { Lang } from "./cases.ts";

const CAFE = {
  en: "A specialty coffee shop in a neighbourhood of Valencia, with about 20 seats",
  es: "Una cafetería de especialidad en un barrio de Valencia, con unas 20 plazas",
};
const SAAS = {
  en: "A SaaS tool for small accounting firms in Spain, sold directly to the firms",
  es: "Un SaaS para gestorías pequeñas en España, vendido directamente a las gestorías",
};
const DENTAL = {
  en: "A dental clinic with two chairs in Seville",
  es: "Una clínica dental con dos sillones en Sevilla",
};
const BAKERY = {
  en: "A small neighbourhood bakery in Bilbao that bakes its own bread",
  es: "Una panadería pequeña de barrio en Bilbao que hace su propio pan",
};
type Business = typeof CAFE;
type Pair = { en: string; es: string };

// ---- Complejidad

export interface ComplexityCase {
  id: string;
  lang: Lang;
  business: string;
  task: string;
  expected: Complexity;
}

function complexity(id: string, business: Business, task: Pair, expected: Complexity): ComplexityCase[] {
  return (["en", "es"] as const).map((lang) => ({ id, lang, business: business[lang], task: task[lang], expected }));
}

export const COMPLEXITY_CASES: ComplexityCase[] = [
  ...complexity("cafe-bank", CAFE, { en: "Open the business bank account", es: "Abre la cuenta del negocio" }, "low"),
  ...complexity("cafe-licences", CAFE, { en: "Get your hospitality licences", es: "Saca las licencias de hostelería" }, "high"),
  ...complexity("cafe-suppliers", CAFE, { en: "Choose your suppliers", es: "Elige tus proveedores" }, "medium"),
  ...complexity("saas-differentiator", SAAS, { en: "Define what makes you different", es: "Define qué te hace diferente" }, "low"),
  ...complexity("saas-mvp", SAAS, { en: "Build your first version", es: "Construye tu primera versión" }, "high"),
  ...complexity("saas-customers", SAAS, { en: "Get your first customers", es: "Consigue tus primeros clientes" }, "medium"),
  ...complexity("dental-hire", DENTAL, { en: "Hire your team", es: "Contrata a tu equipo" }, "high"),
  ...complexity("dental-legal", DENTAL, { en: "Meet the legal requirements of your activity", es: "Cumple los requisitos legales de tu actividad" }, "high"),
  ...complexity("bakery-register", BAKERY, { en: "Register your business", es: "Date de alta" }, "low"),
  ...complexity("bakery-fitout", BAKERY, { en: "Fit out and equip your premises", es: "Acondiciona y equipa tu local" }, "high"),
];

// ---- Tramos de un paso

export interface BandCase {
  id: string;
  lang: Lang;
  business: string;
  task: string;
  step: string;
  actor: Actor;
  effort: EffortBand;
  cost: CostBand;
  /** Solo con tercero. */
  wait?: WaitBand;
}

function band(
  id: string,
  business: Business,
  task: Pair,
  step: Pair,
  actor: Actor,
  labels: { effort: EffortBand; cost: CostBand; wait?: WaitBand },
): BandCase[] {
  return (["en", "es"] as const).map((lang) => ({
    id,
    lang,
    business: business[lang],
    task: task[lang],
    step: step[lang],
    actor,
    ...labels,
  }));
}

const PREMISES = { en: "Find and sign your premises", es: "Busca y firma tu local" };
const LICENCES = { en: "Get your hospitality licences", es: "Saca las licencias de hostelería" };
const MVP = { en: "Build your first version", es: "Construye tu primera versión" };
const DEMAND = { en: "Test that people will buy", es: "Prueba que la gente compra" };
const BRAND = { en: "Create your brand", es: "Crea tu marca" };

export const BAND_CASES: BandCase[] = [
  ...band("cafe-lawyer", CAFE, PREMISES,
    { en: "Have a lawyer review the lease before signing", es: "Que un abogado revise el contrato antes de firmar" },
    "third_party", { effort: "under_1h", cost: "100_500", wait: "under_1w" }),
  ...band("cafe-visit", CAFE, PREMISES,
    { en: "Visit at least 5 premises", es: "Visita al menos 5 locales" },
    "user", { effort: "1_3d", cost: "free" }),
  ...band("cafe-opening-licence", CAFE, LICENCES,
    { en: "Apply for the activity and opening licence at the town hall", es: "Pide en el ayuntamiento la licencia de actividad y apertura" },
    "third_party", { effort: "1_4h", cost: "100_500", wait: "1_3m" }),
  ...band("cafe-handler", CAFE, LICENCES,
    { en: "Get the food handler certificate with an online course", es: "Saca el certificado de manipulador de alimentos con un curso online" },
    "user", { effort: "4_8h", cost: "under_100" }),
  ...band("cafe-suppliers", CAFE, { en: "Choose your suppliers", es: "Elige tus proveedores" },
    { en: "Ask 3 coffee suppliers for prices and terms", es: "Pide precios y condiciones a 3 proveedores de café" },
    "user", { effort: "4_8h", cost: "free" }),
  ...band("cafe-menu", CAFE, { en: "Define your offer and prices", es: "Define tu oferta y tus precios" },
    { en: "Write the final menu", es: "Escribe la carta final" },
    "ai", { effort: "under_1h", cost: "free" }),
  ...band("cafe-logo", CAFE, BRAND,
    { en: "Get a logo from a designer", es: "Encarga un logo a un diseñador" },
    "third_party", { effort: "1_4h", cost: "100_500", wait: "1_4w" }),
  ...band("cafe-name-check", CAFE, BRAND,
    { en: "Check that the name is free in the trademark register", es: "Comprueba en el registro de marcas que el nombre está libre" },
    "user", { effort: "1_4h", cost: "free" }),
  ...band("saas-build", SAAS, MVP,
    { en: "Build the first version yourself", es: "Construye tú la primera versión" },
    "user", { effort: "1_2w", cost: "free" }),
  ...band("saas-freelance", SAAS, MVP,
    { en: "Have a freelance developer build the first version", es: "Encarga la primera versión a un programador autónomo" },
    "third_party", { effort: "1_4h", cost: "2000_10000", wait: "1_3m" }),
  ...band("saas-proposal", SAAS, DEMAND,
    { en: "Write a one-page pilot proposal", es: "Escribe una propuesta de piloto de una página" },
    "ai", { effort: "under_1h", cost: "free" }),
  ...band("saas-contact", SAAS, DEMAND,
    { en: "Contact 20 accounting firms", es: "Contacta con 20 gestorías" },
    "user", { effort: "1_3d", cost: "free" }),
  ...band("saas-privacy", SAAS, { en: "Meet the legal requirements of your activity", es: "Cumple los requisitos legales de tu actividad" },
    { en: "Have a lawyer draft the privacy policy", es: "Que un abogado redacte la política de privacidad" },
    "third_party", { effort: "1_4h", cost: "100_500", wait: "1_4w" }),
  ...band("saas-bank", SAAS, { en: "Open the business bank account", es: "Abre la cuenta del negocio" },
    { en: "Open the account at the bank", es: "Abre la cuenta en el banco" },
    "third_party", { effort: "1_4h", cost: "free", wait: "under_1w" }),
  ...band("saas-table", SAAS, { en: "Study your competitors", es: "Analiza tu competencia" },
    { en: "Build a comparison table from your notes", es: "Monta una tabla comparativa con tus notas" },
    "ai", { effort: "under_1h", cost: "free" }),
  ...band("dental-authorisation", DENTAL, { en: "Meet the legal requirements of your activity", es: "Cumple los requisitos legales de tu actividad" },
    { en: "Apply for the health authorisation for the clinic", es: "Solicita la autorización sanitaria de la clínica" },
    "third_party", { effort: "1_4h", cost: "100_500", wait: "3_6m" }),
  ...band("dental-interviews", DENTAL, { en: "Hire your team", es: "Contrata a tu equipo" },
    { en: "Interview candidates for the hygienist role", es: "Entrevista a candidatos para el puesto de higienista" },
    "user", { effort: "1_3d", cost: "free" }),
  ...band("dental-notary", DENTAL, { en: "Register your business", es: "Date de alta" },
    { en: "Set up the company before a notary", es: "Constituye la sociedad ante notario" },
    "third_party", { effort: "1_4h", cost: "500_2000", wait: "1_4w" }),
  ...band("dental-loan", DENTAL, { en: "Apply for a loan", es: "Pide un préstamo" },
    { en: "Apply for the loan and wait for the answer", es: "Solicita el préstamo y espera la respuesta" },
    "third_party", { effort: "1_4h", cost: "free", wait: "1_4w" }),
  ...band("bakery-oven", BAKERY, { en: "Fit out and equip your premises", es: "Acondiciona y equipa tu local" },
    { en: "Have the supplier install the professional oven", es: "Que el proveedor instale el horno profesional" },
    "third_party", { effort: "1_4h", cost: "free", wait: "1_4w" }),
  ...band("bakery-register", BAKERY, { en: "Register your business", es: "Date de alta" },
    { en: "Register as self-employed with the tax office and social security", es: "Date de alta como autónomo en Hacienda y la Seguridad Social" },
    "user", { effort: "1_4h", cost: "free" }),
  ...band("bakery-invoicing", BAKERY, { en: "Organise your invoicing and taxes", es: "Organiza tu facturación y tus impuestos" },
    { en: "Choose an invoicing app", es: "Elige un programa de facturación" },
    "user", { effort: "1_4h", cost: "free" }),
];

// ---- Especificidad

export type SpecificLabel = "specific" | "generic";

export interface SpecificCase {
  id: string;
  lang: Lang;
  business: string;
  title: string;
  steps: string[];
  label: SpecificLabel;
}

function specific(id: string, business: Business, label: SpecificLabel, en: [string, ...string[]], es: [string, ...string[]]): SpecificCase[] {
  return [
    { id, lang: "en", business: business.en, title: en[0], steps: en.slice(1), label },
    { id, lang: "es", business: business.es, title: es[0], steps: es.slice(1), label },
  ];
}

export const SPECIFIC_CASES: SpecificCase[] = [
  ...specific("cafe-premises", CAFE, "specific",
    ["Find premises for about 20 seated customers in your neighbourhood", "Filter ads for premises with a previous café licence", "Visit the 5 best and check counter, water and accessible toilet"],
    ["Busca locales para unas 20 personas sentadas en tu barrio", "Filtra anuncios de locales con licencia previa de cafetería", "Visita los 5 mejores y comprueba barra, agua y aseo adaptado"]),
  ...specific("cafe-stand", CAFE, "specific",
    ["Test demand with a weekend coffee stand at your local market", "Book a stand for two weekends", "Count how many people buy a second coffee"],
    ["Prueba la demanda con un puesto de café en el mercado de tu barrio", "Reserva un puesto para dos fines de semana", "Cuenta cuánta gente repite café"]),
  ...specific("saas-pilots", SAAS, "specific",
    ["Get 3 accounting firms as paying pilots", "Write a one-page pilot proposal", "Contact 20 small firms and close 3 pilots with a token payment"],
    ["Consigue 3 gestorías piloto que paguen", "Escribe una propuesta de piloto de una página", "Contacta con 20 gestorías pequeñas y cierra 3 pilotos con un pago simbólico"]),
  ...specific("saas-tools", SAAS, "specific",
    ["Compare the tools your interviewed firms use today", "Ask 5 firms which software they use for invoicing", "Note what they complain about in each one"],
    ["Compara los programas que usan hoy las gestorías que entrevistaste", "Pregunta a 5 gestorías qué programa usan para facturar", "Apunta de qué se quejan en cada uno"]),
  ...specific("dental-hygienist", DENTAL, "specific",
    ["Hire a dental hygienist with clinical experience", "Write the job offer for the hygienist role", "Interview candidates with at least two years in a clinic"],
    ["Contrata a un higienista dental con experiencia en clínica", "Escribe la oferta para el puesto de higienista", "Entrevista a candidatos con al menos dos años en clínica"]),
  ...specific("bakery-flour", BAKERY, "specific",
    ["Choose a flour supplier that delivers before 6 am", "List the flours you bake with every day", "Ask 3 suppliers whether they deliver before you start baking"],
    ["Elige un proveedor de harina que entregue antes de las 6", "Apunta las harinas que usas a diario", "Pregunta a 3 proveedores si entregan antes de que empieces a hornear"]),
  ...specific("cafe-strategy", CAFE, "generic",
    ["Research the market and define a strategy", "Analyse the market", "Define your strategy"],
    ["Investiga el mercado y define una estrategia", "Analiza el mercado", "Define tu estrategia"]),
  ...specific("saas-marketing", SAAS, "generic",
    ["Improve your marketing", "Review your marketing", "Apply improvements"],
    ["Mejora tu marketing", "Revisa tu marketing", "Aplica mejoras"]),
  ...specific("dental-launch", DENTAL, "generic",
    ["Plan your launch carefully", "Make a plan", "Follow the plan"],
    ["Planifica bien tu lanzamiento", "Haz un plan", "Sigue el plan"]),
  ...specific("bakery-premises", BAKERY, "generic",
    ["Find the right premises", "Look for premises", "Choose the best one"],
    ["Encuentra el local adecuado", "Busca locales", "Elige el mejor"]),
  ...specific("cafe-goals", CAFE, "generic",
    ["Get organised and set goals", "Write your goals", "Review them regularly"],
    ["Organízate y fija objetivos", "Escribe tus objetivos", "Revísalos a menudo"]),
  ...specific("saas-competitors", SAAS, "generic",
    ["Analyse your competitors", "Find competitors", "Compare them"],
    ["Analiza a tus competidores", "Busca competidores", "Compáralos"]),
];