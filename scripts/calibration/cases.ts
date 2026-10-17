/**
 * Casos etiquetados para calibrar Jev. Las etiquetas (expected, label) las revisa una persona,
 * nunca un modelo: si no, mediríamos a Jev contra otra IA.
 * Cada caso va en inglés y en español para medir si el idioma cambia el acierto.
 */
import { CATALOG_JEV_QUESTIONS, LIKELY_JEV_QUESTIONS } from "../../src/lib/report/questions.ts";

export type Lang = "en" | "es";

// Las mismas preguntas que usa la app (todo el catálogo): los umbrales solo valen para este texto exacto.
export const CHOICE_QUESTIONS = CATALOG_JEV_QUESTIONS;

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

  // ---- Catálogo ampliado (paso 5d)
  ...choicePair("cs-consumers", "customer_segment", "Consumers",
    "A mobile app that helps people track their personal spending",
    "Una app móvil para que las personas controlen sus gastos personales"),
  ...choicePair("cs-smb", "customer_segment", "Small businesses (1-50)",
    "Accounting software for small shops with fewer than 10 employees",
    "Software de contabilidad para tiendas pequeñas de menos de 10 empleados"),
  ...choicePair("cs-public", "customer_segment", "Public sector",
    "A platform that city councils use to manage public tenders",
    "Una plataforma que usan los ayuntamientos para gestionar licitaciones públicas"),
  ...choicePair("cs-ns", "customer_segment", "Not specified",
    "A business that sells something",
    "Un negocio que vende algo"),

  ...choicePair("of-product", "offering_type", "Physical product",
    "I want to sell handmade leather bags",
    "Quiero vender bolsos de cuero hechos a mano"),
  ...choicePair("of-service", "offering_type", "People-delivered service",
    "A home cleaning service with my own staff",
    "Un servicio de limpieza a domicilio con mi propio personal"),
  ...choicePair("of-venue", "offering_type", "Physical venue",
    "Opening a climbing gym in Bilbao",
    "Abrir un rocódromo en Bilbao"),
  ...choicePair("of-ns", "offering_type", "Not specified",
    "Something related to sport",
    "Algo relacionado con el deporte"),

  ...choicePair("rm-sub", "revenue_model", "Subscription",
    "Customers pay a monthly fee to use the tool",
    "Los clientes pagan una cuota mensual para usar la herramienta"),
  ...choicePair("rm-commission", "revenue_model", "Transaction commission",
    "A marketplace that keeps 10% of every sale between buyers and sellers",
    "Un marketplace que se queda un 10 % de cada venta entre compradores y vendedores"),
  ...choicePair("rm-hours", "revenue_model", "Services by hours or projects",
    "A freelance consultancy billed by the hour",
    "Una consultoría como autónomo que factura por horas"),
  ...choicePair("rm-ns", "revenue_model", "Not specified",
    "An app for dog owners",
    "Una app para dueños de perros"),

  ...choicePair("bb-low", "budget_band", "Under €5k",
    "I have 3,000 euros saved to start",
    "Tengo 3.000 euros ahorrados para empezar"),
  ...choicePair("bb-mid", "budget_band", "€20k-€50k",
    "I can invest 40,000 euros in the bar",
    "Puedo invertir 40.000 euros en el bar"),
  ...choicePair("bb-high", "budget_band", "€150k-€500k",
    "We have raised 300,000 euros from investors",
    "Hemos levantado 300.000 euros de inversores"),
  ...choicePair("bb-ns", "budget_band", "Not specified",
    "A bakery in my town",
    "Una panadería en mi pueblo"),

  ...choicePair("fe-none", "founder_experience", "None",
    "I have never worked in restaurants but I want to open one",
    "Nunca he trabajado en hostelería pero quiero abrir un restaurante"),
  ...choicePair("fe-mid", "founder_experience", "2-5 years",
    "I have worked as a waiter for three years and want my own bar",
    "Llevo tres años de camarero y quiero mi propio bar"),
  ...choicePair("fe-high", "founder_experience", "Over 5 years",
    "After 12 years as a dentist I want to open my own dental clinic",
    "Después de 12 años como dentista quiero abrir mi propia clínica dental"),
  ...choicePair("fe-ns", "founder_experience", "Not specified",
    "A clothing store",
    "Una tienda de ropa"),

  ...choicePair("fp-tech", "founder_profile", "Technical",
    "I am a software engineer and want to build an app for gyms",
    "Soy ingeniero de software y quiero crear una app para gimnasios"),
  ...choicePair("fp-commercial", "founder_profile", "Commercial",
    "I have been a sales rep for 10 years and want to start a distribution company",
    "Llevo 10 años como comercial y quiero montar una distribuidora"),
  ...choicePair("fp-expert", "founder_profile", "Sector expert",
    "I am a veterinarian and want to open my own veterinary clinic",
    "Soy veterinario y quiero abrir mi propia clínica veterinaria"),
  ...choicePair("fp-ns", "founder_profile", "Not specified",
    "A food truck",
    "Un food truck"),

  ...choicePair("tc-low", "time_commitment", "Under 10 h/week",
    "I can only work on it at weekends, about 6 hours a week",
    "Solo puedo dedicarle los fines de semana, unas 6 horas a la semana"),
  ...choicePair("tc-mid", "time_commitment", "10-20 h/week",
    "I will work on it in the evenings, around 15 hours a week",
    "Le dedicaré las tardes, unas 15 horas a la semana"),
  ...choicePair("tc-full", "time_commitment", "Full time",
    "I will quit my job and work on it full time",
    "Dejaré mi trabajo y me dedicaré a tiempo completo"),
  ...choicePair("tc-ns", "time_commitment", "Not specified",
    "An online plant shop",
    "Una tienda online de plantas"),

  ...choicePair("df-price", "differentiator", "Price",
    "Haircuts at half the price of any salon in the area",
    "Cortes de pelo a la mitad de precio que cualquier peluquería de la zona"),
  ...choicePair("df-niche", "differentiator", "Specialized niche",
    "A gym exclusively for people over 65",
    "Un gimnasio exclusivamente para mayores de 65 años"),
  ...choicePair("df-tech", "differentiator", "Technology or IP",
    "A patented sensor that detects water leaks in old buildings",
    "Un sensor patentado que detecta fugas de agua en edificios antiguos"),
  ...choicePair("df-none", "differentiator", "None identified",
    "Another burger place just like the ones already on my street",
    "Otra hamburguesería igual que las que ya hay en mi calle"),
  ...choicePair("df-ns", "differentiator", "Not specified",
    "A pizzeria in Valencia",
    "Una pizzería en Valencia"),

  ...choicePair("ac-foot", "acquisition_channel", "Foot traffic or location",
    "A café on a busy shopping street that lives off passers-by",
    "Una cafetería en una calle comercial muy transitada que vive de la gente que pasa"),
  ...choicePair("ac-ads", "acquisition_channel", "Paid advertising",
    "I will get customers with Instagram and Google ads",
    "Conseguiré clientes con anuncios en Instagram y Google"),
  ...choicePair("ac-sales", "acquisition_channel", "Direct sales",
    "A sales team will visit factories to sell our software",
    "Un equipo comercial visitará fábricas para vender nuestro software"),
  ...choicePair("ac-ns", "acquisition_channel", "Not specified",
    "A language academy",
    "Una academia de idiomas"),

  ...choicePair("co-crowded", "competition", "Crowded market",
    "Another coffee shop on a street that already has eight",
    "Otra cafetería en una calle que ya tiene ocho"),
  ...choicePair("co-large", "competition", "Dominated by large players",
    "A search engine to compete with Google",
    "Un buscador para competir con Google"),
  ...choicePair("co-niche", "competition", "Niche with no clear competitors",
    "Repairing antique music boxes; I know nobody else who does it in Spain",
    "Reparar cajas de música antiguas; no conozco a nadie más que lo haga en España"),
  ...choicePair("co-ns", "competition", "Not specified",
    "A photography studio",
    "Un estudio de fotografía"),

  ...choicePair("ci-low", "capital_intensity", "Low (digital, near-zero marginal cost)",
    "A newsletter I write myself and sell by subscription",
    "Una newsletter que escribo yo y vendo por suscripción"),
  ...choicePair("ci-high", "capital_intensity", "High (inventory, equipment, premises or R&D)",
    "A brewery with its own production plant",
    "Una cervecera con su propia planta de producción"),
  ...choicePair("ci-ns", "capital_intensity", "Not specified",
    "A business in Madrid",
    "Un negocio en Madrid"),

  ...choicePair("tr-solo", "team_requirement", "Feasible solo",
    "I will run the online course business entirely on my own",
    "Llevaré el negocio de cursos online yo solo"),
  ...choicePair("tr-large", "team_requirement", "Large team",
    "A hotel with 60 rooms and a restaurant",
    "Un hotel de 60 habitaciones con restaurante"),
  ...choicePair("tr-spec", "team_requirement", "Specialized profiles required",
    "A surgical clinic that needs licensed anaesthetists and surgeons",
    "Una clínica quirúrgica que necesita anestesistas y cirujanos colegiados"),
  ...choicePair("tr-ns", "team_requirement", "Not specified",
    "Selling something online",
    "Vender algo por internet"),

  ...choicePair("ttr-now", "time_to_revenue", "Immediate",
    "I already have clients waiting; I will start invoicing next week",
    "Ya tengo clientes esperando; empezaré a facturar la semana que viene"),
  ...choicePair("ttr-long", "time_to_revenue", "More than 12 months",
    "A new drug that needs years of clinical trials before it can be sold",
    "Un fármaco nuevo que necesita años de ensayos clínicos antes de poder venderse"),
  ...choicePair("ttr-ns", "time_to_revenue", "Not specified",
    "A clothing brand",
    "Una marca de ropa"),

  ...choicePair("rl-heavy", "regulatory_load", "Heavy (health, finance, food)",
    "Opening a pharmacy",
    "Abrir una farmacia"),
  ...choicePair("rl-critical", "regulatory_load", "Critical or multi-jurisdiction",
    "A cryptocurrency exchange operating in the EU and the US",
    "Un exchange de criptomonedas que opera en la UE y en EE. UU."),
  ...choicePair("rl-ns", "regulatory_load", "Not specified",
    "A business with my friends",
    "Un negocio con mis amigos"),

  ...choicePair("td-platform", "third_party_dependency", "Depends on a platform",
    "I will sell only through Amazon",
    "Venderé solo a través de Amazon"),
  ...choicePair("td-critical", "third_party_dependency", "Critical dependency",
    "My whole business resells the products of a single manufacturer under an exclusive contract",
    "Todo mi negocio revende los productos de un único fabricante con un contrato de exclusiva"),
  ...choicePair("td-ns", "third_party_dependency", "Not specified",
    "A yoga studio",
    "Un estudio de yoga"),

  ...choicePair("mh-provider", "money_handling", "Collects through a payment provider",
    "An online shop that charges customers with Stripe",
    "Una tienda online que cobra a los clientes con Stripe"),
  ...choicePair("mh-holds", "money_handling", "Holds or intermediates funds",
    "An app where users deposit money that we keep and pay to sellers later",
    "Una app en la que los usuarios depositan dinero que guardamos y pagamos después a los vendedores"),
  ...choicePair("mh-ns", "money_handling", "Not specified",
    "A design studio",
    "Un estudio de diseño"),

  ...choicePair("lt-fast", "launch_timeline", "Under 3 months",
    "I want to open within two months",
    "Quiero abrir en dos meses"),
  ...choicePair("lt-year", "launch_timeline", "6-12 months",
    "We plan to launch in about nine months",
    "Pensamos lanzar en unos nueve meses"),
  ...choicePair("lt-long", "launch_timeline", "Over 18 months",
    "It will take us two years to launch",
    "Tardaremos dos años en lanzar"),
  ...choicePair("lt-ns", "launch_timeline", "Not specified",
    "A flower shop",
    "Una floristería"),

  // ---- Fronteras de los tramos y pago por compra (paso N1)
  ...choicePair("lt-6m", "launch_timeline", "3-6 months",
    "I want to open a tapas bar in about 6 months",
    "Quiero abrir un bar de tapas en unos 6 meses"),
  ...choicePair("lt-12m", "launch_timeline", "6-12 months",
    "We will launch the app in 12 months",
    "Lanzaremos la app dentro de 12 meses"),
  ...choicePair("bb-20k", "budget_band", "€5k-€20k",
    "I have 20,000 euros to start my shop",
    "Tengo 20.000 euros para empezar mi tienda"),
  ...choicePair("bb-50k", "budget_band", "€20k-€50k",
    "I can invest 50,000 euros in the gym",
    "Puedo invertir 50.000 euros en el gimnasio"),
  ...choicePair("fe-2y", "founder_experience", "2-5 years",
    "I have worked in hair salons for 2 years and want my own",
    "Llevo 2 años trabajando en peluquerías y quiero la mía"),
  ...choicePair("fe-5y", "founder_experience", "2-5 years",
    "After 5 years as a physiotherapist I want my own practice",
    "Después de 5 años como fisioterapeuta quiero mi propia consulta"),
  ...choicePair("tc-20h", "time_commitment", "10-20 h/week",
    "I will dedicate about 20 hours a week to the bakery",
    "Le dedicaré unas 20 horas a la semana a la panadería"),
  ...choicePair("tc-40h", "time_commitment", "Full time",
    "I will work on it 40 hours a week",
    "Le dedicaré 40 horas a la semana"),
  ...choicePair("ttr-1m", "time_to_revenue", "Immediate",
    "I will start invoicing in the first month",
    "Empezaré a facturar en el primer mes"),
  ...choicePair("rm-bar", "revenue_model", "One-time sale",
    "A tapas bar where customers pay for what they eat and drink",
    "Un bar de tapas donde los clientes pagan lo que consumen"),
  ...choicePair("rm-salon", "revenue_model", "One-time sale",
    "A hair salon that charges for each haircut",
    "Una peluquería que cobra cada corte de pelo"),
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
const GRANVIA_EN = "A small café on Gran Vía, the main shopping street of Madrid";
const GRANVIA_ES = "Una cafetería pequeña en la Gran Vía, la principal calle comercial de Madrid";
const RESIDENTIAL_EN = "A neighbourhood bakery on a quiet residential street on the outskirts of Bilbao";
const RESIDENTIAL_ES = "Una panadería de barrio en una calle residencial tranquila de las afueras de Bilbao";

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

  // Cifras del paso 8b y opciones del catálogo inferidas por GPT (paso 7).
  ...noulPair("bar-startup", "plausible", "startup_cost_eur", { min: 60000, max: 150000 }, BAR_EN, BAR_ES),
  ...noulPair("bar-startup-absurd", "implausible", "startup_cost_eur", { min: 100, max: 500 }, BAR_EN, BAR_ES),
  ...noulPair("saas-fixed", "plausible", "monthly_fixed_costs_eur", { min: 200, max: 2000 }, SAAS_EN, SAAS_ES),
  ...noulPair("saas-fixed-absurd", "implausible", "monthly_fixed_costs_eur", { min: 500000, max: 900000 }, SAAS_EN, SAAS_ES),
  ...noulPair("bar-competition", "plausible", "competition", "Crowded market", BAR_EN, BAR_ES),
  ...noulPair("bar-regulation-absurd", "implausible", "regulatory_load", "None", BAR_EN, BAR_ES),
  ...noulPair("dental-team", "plausible", "team_requirement", "Specialized profiles required", DENTAL_EN, DENTAL_ES),
   ...noulPair("saas-channel-absurd", "implausible", "acquisition_channel", "Foot traffic or location", SAAS_EN, SAAS_ES),

  // Nivel de alquiler (paso 9c).
  ...noulPair("granvia-prime", "plausible", "rent_level", "Prime location", GRANVIA_EN, GRANVIA_ES),
  ...noulPair("residential-average", "plausible", "rent_level", "Average", RESIDENTIAL_EN, RESIDENTIAL_ES),
  ...noulPair("granvia-below-absurd", "implausible", "rent_level", "Below average", GRANVIA_EN, GRANVIA_ES),
  ...noulPair("residential-prime-absurd", "implausible", "rent_level", "Prime location", RESIDENTIAL_EN, RESIDENTIAL_ES),
];

// La misma pregunta de plausibilidad que usa la app.
export { PLAUSIBILITY_QUESTION } from "../../src/lib/report/plausibility.ts";


// ---- Preguntas "probable" (paso D1a): el dato no está escrito, pero se deduce del tipo de negocio.
// Revisa las etiquetas: "Can't tell" cuando de verdad no se puede deducir.

export const LIKELY_QUESTIONS = LIKELY_JEV_QUESTIONS;

export const LIKELY_CASES: ChoiceCase[] = [
  // Bar de tapas: casi todo se deduce.
  ...choicePair("lk-bar-customer", "customer_segment", "Consumers",
    "A tapas bar in Malasaña, Madrid", "Un bar de tapas en Malasaña, Madrid"),
  ...choicePair("lk-bar-revenue", "revenue_model", "One-time sale",
    "A tapas bar in Malasaña, Madrid", "Un bar de tapas en Malasaña, Madrid"),
  ...choicePair("lk-bar-channel", "acquisition_channel", "Foot traffic or location",
    "A tapas bar in Malasaña, Madrid", "Un bar de tapas en Malasaña, Madrid"),
  ...choicePair("lk-bar-regulation", "regulatory_load", "Heavy (health, finance, food)",
    "A tapas bar in Malasaña, Madrid", "Un bar de tapas en Malasaña, Madrid"),
  ...choicePair("lk-bar-capital", "capital_intensity", "High (inventory, equipment, premises or R&D)",
    "A tapas bar in Malasaña, Madrid", "Un bar de tapas en Malasaña, Madrid"),
  ...choicePair("lk-bar-scope", "geographic_scope", "Hyper-local",
    "A neighbourhood tapas bar in Malasaña, Madrid", "Un bar de tapas de barrio en Malasaña, Madrid"),
  ...choicePair("lk-bar-stage", "validation_stage", "Idea only",
    "I want to open a tapas bar in Madrid", "Quiero abrir un bar de tapas en Madrid"),

  // SaaS de facturación.
  ...choicePair("lk-saas-customer", "customer_segment", "Small businesses (1-50)",
    "Invoicing software for small companies", "Un software de facturación para empresas pequeñas"),
  ...choicePair("lk-saas-revenue", "revenue_model", "Subscription",
    "A SaaS tool for invoicing", "Una herramienta SaaS de facturación"),
  ...choicePair("lk-saas-channel", "acquisition_channel", "Online self-service",
    "A SaaS tool for invoicing", "Una herramienta SaaS de facturación"),
  ...choicePair("lk-saas-capital", "capital_intensity", "Low (digital, near-zero marginal cost)",
    "A SaaS tool for invoicing", "Una herramienta SaaS de facturación"),
  ...choicePair("lk-saas-offering", "offering_type", "Software",
    "A tool so that freelancers can make their invoices", "Una herramienta para que los autónomos hagan sus facturas"),

  // Otros negocios.
  ...choicePair("lk-gym-revenue", "revenue_model", "Subscription",
    "A neighbourhood gym", "Un gimnasio de barrio"),
  ...choicePair("lk-storage-revenue", "revenue_model", "Transaction commission",
    "A platform where people rent their spare storage rooms to others", "Una plataforma para que particulares alquilen sus trasteros a otros"),
  ...choicePair("lk-pharmacy-regulation", "regulatory_load", "Heavy (health, finance, food)",
    "Opening a pharmacy", "Abrir una farmacia"),
  ...choicePair("lk-hotel-team", "team_requirement", "Large team",
    "A hotel with 60 rooms", "Un hotel de 60 habitaciones"),
  ...choicePair("lk-newsletter-team", "team_requirement", "Feasible solo",
    "A paid newsletter about personal finance", "Una newsletter de pago sobre finanzas personales"),
  ...choicePair("lk-search-competition", "competition", "Dominated by large players",
    "A new general web search engine", "Un nuevo buscador web generalista"),
  ...choicePair("lk-bar-competition", "competition", "Crowded market",
    "Another tapas bar in the centre of Madrid", "Otro bar de tapas en el centro de Madrid"),
  ...choicePair("lk-drug-revenue-time", "time_to_revenue", "More than 12 months",
    "Developing a new drug", "Desarrollar un fármaco nuevo"),
  ...choicePair("lk-youtube-dependency", "third_party_dependency", "Depends on a platform",
    "A cooking channel on YouTube", "Un canal de cocina en YouTube"),
  ...choicePair("lk-shop-money", "money_handling", "Collects through a payment provider",
    "An online clothing shop", "Una tienda online de ropa"),
  ...choicePair("lk-bakery-sector", "sector", "Hospitality/Food service",
    "A place where people come for coffee and pastries", "Un sitio donde la gente venga a tomar café y bollería"),

  // Los que rompen: el verbo dice "abrir", pero el negocio ya existe.
  ...choicePair("lk-salon-second", "validation_stage", "Growing",
    "I want to open a second location of my hair salon", "Quiero abrir un segundo local de mi peluquería"),
  ...choicePair("lk-clients-expand", "validation_stage", "Generating revenue",
    "I already have paying clients and want to open my own studio", "Ya tengo clientes que me pagan y quiero abrir mi propio estudio"),

  // No se puede deducir.
  ...choicePair("lk-online-customer", "customer_segment", "Can't tell",
    "An online business", "Un negocio online"),
  ...choicePair("lk-friends-revenue", "revenue_model", "Can't tell",
    "A business with my friends", "Un negocio con mis amigos"),
  ...choicePair("lk-project-sector", "sector", "Can't tell",
    "A new project", "Un proyecto nuevo"),
];

// ---- Cantidades (N2): Jev elige qué cantidad del texto responde a cada pregunta.
import type { PhraseDimension } from "../../src/lib/report/phrases.ts";

export interface PhraseCase {
  id: string;
  lang: Lang;
  dimension: PhraseDimension;
  text: string;
  /** Texto literal de la cantidad correcta (tal como la extrae el código) o "None". */
  expected: string;
}

function phrasePair(id: string, dimension: PhraseDimension, en: [string, string], es: [string, string]): PhraseCase[] {
  return [
    { id, lang: "en", dimension, text: en[0], expected: en[1] },
    { id, lang: "es", dimension, text: es[0], expected: es[1] },
  ];
}

const WAITER_EN = "I've been a waiter for 10 years and want to open my bar in 2 years";
const WAITER_ES = "Llevo 10 años de camarero y quiero abrir mi bar en 2 años";
const AGE_EN = "I'm 30 years old and want to build an app";
const AGE_ES = "Tengo 30 años y quiero montar una app";

export const PHRASE_CASES: PhraseCase[] = [
  ...phrasePair("ph-bud-saved", "budget",
    ["I have €20,000 saved to open a café", "€20,000"],
    ["Tengo 20.000 € ahorrados para abrir una cafetería", "20.000 €"]),
  ...phrasePair("ph-bud-rent", "budget",
    ["A bar; the rent is €2,000 a month and I have €30,000 to start", "€30,000"],
    ["Un bar; el alquiler es de 2.000 € al mes y tengo 30.000 € para empezar", "30.000 €"]),
  ...phrasePair("ph-bud-cost", "budget",
    ["A café that costs about €80,000 to set up", "None"],
    ["Una cafetería que cuesta unos 80.000 € montar", "None"]),
  ...phrasePair("ph-bud-k", "budget",
    ["I have 15k to start an online shop", "15k"],
    ["Tengo 15k para empezar una tienda online", "15k"]),
  ...phrasePair("ph-bud-mil", "budget",
    ["I can count on 50 thousand euros for my bakery", "50 thousand euros"],
    ["Cuento con 50 mil euros para mi panadería", "50 mil euros"]),
  ...phrasePair("ph-lau-months", "launch",
    ["I want to open a hair salon in 4 months", "4 months"],
    ["Quiero abrir una peluquería en 4 meses", "4 meses"]),
  ...phrasePair("ph-lau-range", "launch",
    ["I'll open my shop in 6-8 months", "6-8 months"],
    ["Abriré mi tienda en 6-8 meses", "6-8 meses"]),
  ...phrasePair("ph-lau-waiter", "launch", [WAITER_EN, "2 years"], [WAITER_ES, "2 años"]),
  ...phrasePair("ph-exp-waiter", "experience", [WAITER_EN, "10 years"], [WAITER_ES, "10 años"]),
  ...phrasePair("ph-lau-age", "launch", [AGE_EN, "None"], [AGE_ES, "None"]),
  ...phrasePair("ph-exp-age", "experience", [AGE_EN, "None"], [AGE_ES, "None"]),
  ...phrasePair("ph-exp-range", "experience",
    ["I worked 3 to 5 years at a marketing agency and want to start my own", "3 to 5 years"],
    ["Trabajé de 3 a 5 años en una agencia de marketing y quiero montar la mía", "3 a 5 años"]),
  ...phrasePair("ph-exp-other", "experience",
    ["I was an accountant for 8 years and now want to open a restaurant", "None"],
    ["Fui contable 8 años y ahora quiero abrir un restaurante", "None"]),
];
