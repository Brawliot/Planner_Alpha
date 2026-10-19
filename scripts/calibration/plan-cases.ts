/**
 * Casos etiquetados para calibrar a Jev como juez del plan (src/lib/plan/judge.ts): especificidad.
 * Las etiquetas LAS REVISA UNA PERSONA, nunca un modelo. Cada caso va en inglés y en español.
 * Los casos de complejidad y tramos se retiraron tras calibrarlos (ver judge.ts y el historial de git).
 */
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
/** Tope de tareas generadas por molde: GPT decide cuántas (de 1 a este número). */
export const MAX_GENERATED_TASKS = 3;

/** "Generar" solo sobre una tarea del catálogo que sale de un molde y está sin tocar. */

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