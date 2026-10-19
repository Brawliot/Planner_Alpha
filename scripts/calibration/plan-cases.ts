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


// ---- Calidad de las preguntas previas

export type QuestionLabel = "good" | "bad";

export interface QuestionCase {
  id: string;
  lang: Lang;
  business: string;
  text: string;
  options: string[];
  otherTasks: string[];
  previous: { question: string; answer: string }[];
  label: QuestionLabel;
}

interface QuestionText {
  text: string;
  options: string[];
  otherTasks?: string[];
  previous?: { question: string; answer: string }[];
}

function question(id: string, business: Business, label: QuestionLabel, en: QuestionText, es: QuestionText): QuestionCase[] {
  return (["en", "es"] as const).map((lang) => {
    const q = lang === "en" ? en : es;
    return {
      id,
      lang,
      business: business[lang],
      text: q.text,
      options: q.options,
      otherTasks: q.otherTasks ?? [],
      previous: q.previous ?? [],
      label,
    };
  });
}

const OFFER_EN = ["Define your offer and prices"];
const OFFER_ES = ["Define tu oferta y tus precios"];

export const QUESTION_CASES: QuestionCase[] = [
  // Buenas: algo que el usuario sabe o prefiere, cambia las tareas y no está en ningún sitio.
  ...question("cafe-zone", CAFE, "good",
    { text: "Do you already have a specific area of the neighbourhood in mind?", options: ["Yes, a specific street", "A few options", "Not yet"] },
    { text: "¿Tienes ya una zona concreta del barrio en mente?", options: ["Sí, una calle concreta", "Varias opciones", "Aún no"] }),
  ...question("cafe-days", CAFE, "good",
    { text: "Which days do you want to open?", options: ["Every day", "Monday to Saturday", "Weekdays only"] },
    { text: "¿Qué días quieres abrir?", options: ["Todos", "De lunes a sábado", "Solo laborables"] }),
  ...question("saas-contacts", SAAS, "good",
    { text: "Do you already know an accounting firm that would try it?", options: ["Yes, some", "No"] },
    { text: "¿Conoces ya alguna gestoría que quiera probarlo?", options: ["Sí, alguna", "No"] }),
  ...question("saas-build", SAAS, "good",
    { text: "Will you program the first version yourself?", options: ["Yes", "Partly", "No"] },
    { text: "¿Vas a programar tú la primera versión?", options: ["Sí", "En parte", "No"] }),
  ...question("dental-dentist", DENTAL, "good",
    { text: "Will you work as a dentist in the clinic yourself?", options: ["Yes, full time", "Part time", "No"] },
    { text: "¿Trabajarás tú como dentista en la clínica?", options: ["Sí, a tiempo completo", "A tiempo parcial", "No"] }),
  ...question("dental-patients", DENTAL, "good",
    { text: "Do you already have patients who would follow you to the new clinic?", options: ["Yes, many", "A few", "No"] },
    { text: "¿Tienes ya pacientes que te seguirían a la nueva clínica?", options: ["Sí, muchos", "Algunos", "No"] }),
  ...question("bakery-tables", BAKERY, "good",
    { text: "Do you want tables so customers can eat inside?", options: ["Yes", "No"] },
    { text: "¿Quieres mesas para que los clientes tomen algo dentro?", options: ["Sí", "No"] }),
  ...question("bakery-time", BAKERY, "good",
    { text: "By what time do you want the bread ready each morning?", options: ["Before 7", "Between 7 and 9", "Later"] },
    { text: "¿A qué hora quieres tener el pan listo cada mañana?", options: ["Antes de las 7", "Entre las 7 y las 9", "Más tarde"] }),

  // Malas.
  ...question("cafe-seats-known", CAFE, "bad", // ya lo dice: "unas 20 plazas"
    { text: "How many people do you want to be able to seat?", options: ["Up to 10", "10 to 30", "More than 30"] },
    { text: "¿Cuántas personas quieres poder sentar?", options: ["Hasta 10", "De 10 a 30", "Más de 30"] }),
  ...question("cafe-cook", CAFE, "bad", // lo decide otra tarea pendiente
    { text: "Will you cook or only serve drinks and pastries?", options: ["Cook", "Only drinks and pastries"], otherTasks: OFFER_EN },
    { text: "¿Vas a cocinar o solo servir bebidas y bollería?", options: ["Cocinar", "Solo bebidas y bollería"], otherTasks: OFFER_ES }),
  ...question("cafe-likes", CAFE, "bad", // no cambia ninguna tarea
    { text: "Do you like coffee?", options: ["Yes", "No"] },
    { text: "¿Te gusta el café?", options: ["Sí", "No"] }),
  ...question("cafe-rent", CAFE, "bad", // es investigación: el usuario no lo sabe
    { text: "How much is rent in your neighbourhood?", options: ["Under 1,000 euros", "1,000 to 2,000 euros", "More"] },
    { text: "¿Cuánto cuesta el alquiler en tu barrio?", options: ["Menos de 1.000 €", "De 1.000 a 2.000 €", "Más"] }),
  ...question("saas-price", SAAS, "bad", // lo decide otra tarea pendiente
    { text: "What monthly price will you charge?", options: ["Under 20 euros", "20 to 50 euros", "More"], otherTasks: OFFER_EN },
    { text: "¿Qué precio mensual vas a cobrar?", options: ["Menos de 20 €", "De 20 a 50 €", "Más"], otherTasks: OFFER_ES }),
  ...question("saas-customer-known", SAAS, "bad", // ya lo dice: gestorías
    { text: "What kind of customer will you sell to?", options: ["Accounting firms", "Freelancers", "Companies"] },
    { text: "¿A qué tipo de cliente vas a vender?", options: ["Gestorías", "Autónomos", "Empresas"] }),
  ...question("saas-competitors", SAAS, "bad", // es investigación
    { text: "How many competitors does your software have?", options: ["Few", "Many"] },
    { text: "¿Cuántos competidores tiene tu programa?", options: ["Pocos", "Muchos"] }),
  ...question("dental-chairs-known", DENTAL, "bad", // ya lo dice: dos sillones
    { text: "How many chairs will the clinic have?", options: ["1", "2", "3 or more"] },
    { text: "¿Cuántos sillones tendrá la clínica?", options: ["1", "2", "3 o más"] }),
  ...question("bakery-answered", BAKERY, "bad", // ya respondida
    { text: "Will you put tables in the shop?", options: ["Yes", "No"], previous: [{ question: "Do you want tables so customers can eat inside?", answer: "No" }] },
    { text: "¿Pondrás mesas en el local?", options: ["Sí", "No"], previous: [{ question: "¿Quieres mesas para que los clientes tomen algo dentro?", answer: "No" }] }),
  ...question("bakery-vague", BAKERY, "bad", // vaga, no cambia nada
    { text: "Are you sure about your idea?", options: ["Yes", "No"] },
    { text: "¿Estás seguro de tu idea?", options: ["Sí", "No"] }),
];