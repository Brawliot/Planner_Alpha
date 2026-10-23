import { CANT_TELL, DONT_KNOW, NOT_DECIDED, NOT_SPECIFIED } from "./certainty.ts";

/** Texto en español de cada valor guardado (que sigue en inglés: es la clave de Jev y de la base de datos). */
const LABELS: Record<string, string> = {
  [NOT_DECIDED]: "Aún no lo he decidido",
  [DONT_KNOW]: "No lo sé",
  [CANT_TELL]: "No se puede deducir",
  [NOT_SPECIFIED]: "Sin especificar",

  // sector
  "Technology/SaaS": "Tecnología / SaaS",
  "Hospitality/Food service": "Hostelería / Restauración",
  "Retail/Commerce": "Comercio",
  Manufacturing: "Fabricación",
  "Professional Services": "Servicios profesionales",
  "Finance/Banking/Insurance": "Finanzas / Banca / Seguros",
  "Health/Medicine": "Salud / Medicina",
  "Education/Training": "Educación / Formación",
  "Logistics/Transport": "Logística / Transporte",
  "Construction/Real Estate": "Construcción / Inmobiliaria",
  "Marketing/Advertising/Agencies": "Marketing / Publicidad / Agencias",
  "Media/Content/Entertainment": "Medios / Contenidos / Ocio",
  "Agriculture/Livestock": "Agricultura / Ganadería",
  "Energy/Utilities": "Energía / Suministros",
  "Consulting/Advisory": "Consultoría / Asesoría",
  Other: "Otro",

  // offering_type
  "Physical product": "Producto físico",
  Software: "Software",
  "People-delivered service": "Servicio prestado por personas",
  "Platform or marketplace": "Plataforma o marketplace",
  "Content or media": "Contenido o medios",
  "Hardware plus software": "Dispositivo más software",
  "Physical venue": "Local físico",

  // revenue_model
  Subscription: "Suscripción",
  "One-time sale": "Venta puntual",
  "Transaction commission": "Comisión por transacción",
  "Usage-based": "Pago por uso",
  Advertising: "Publicidad",
  Freemium: "Freemium",
  "Services by hours or projects": "Servicios por horas o proyectos",
  Licensing: "Licencias",
  Hybrid: "Mixto",

  // customer_segment
  Consumers: "Consumidores",
  "Small businesses (1-50)": "Pequeñas empresas (1-50)",
  "Medium businesses (51-250)": "Medianas empresas (51-250)",
  "Large businesses (250+)": "Grandes empresas (más de 250)",
  "Public sector": "Sector público",
  Nonprofits: "Entidades sin ánimo de lucro",
  "Two-sided marketplace": "Marketplace de dos partes",
  "Mixed segments": "Varios tipos de cliente",

  // geographic_scope
  "Hyper-local": "Hiperlocal (un barrio)",
  Local: "Local (una ciudad)",
  Regional: "Regional",
  National: "Nacional",
  International: "Internacional",
  Online: "Solo online",

  // differentiator
  "Technology or IP": "Tecnología o propiedad intelectual",
  Price: "Precio",
  "Quality or experience": "Calidad o experiencia",
  "Specialized niche": "Nicho especializado",
  "Convenience or speed": "Comodidad o rapidez",
  Brand: "Marca",
  "Network effect": "Efecto red",
  "None identified": "Ninguno claro",

  // founder_experience
  None: "Ninguna",
  "Under 2 years": "Menos de 2 años",
  "2-5 years": "De 2 a 5 años",
  "Over 5 years": "Más de 5 años",

  // founder_profile
  Technical: "Técnicas",
  Commercial: "Comerciales",
  "Sector expert": "Experto del sector",
  Management: "Gestión de equipos",
  "Several areas": "Varias áreas",
  "No relevant background": "Sin experiencia relevante",

  // time_commitment
  "Under 10 h/week": "Menos de 10 h/semana",
  "10-20 h/week": "10-20 h/semana",
  "20-40 h/week": "20-40 h/semana",
  "Full time": "Jornada completa",

  // budget_band
  "Under €5k": "Menos de 5.000 €",
  "€5k-€20k": "5.000-20.000 €",
  "€20k-€50k": "20.000-50.000 €",
  "€50k-€150k": "50.000-150.000 €",
  "€150k-€500k": "150.000-500.000 €",
  "Over €500k": "Más de 500.000 €",

  // validation_stage
  "Idea only": "Solo la idea",
  "Problem validated": "Problema validado",
  Prototype: "Prototipo",
  "MVP with customers": "MVP con clientes",
  "Generating revenue": "Ya genera ingresos",
  Growing: "En crecimiento",

  // launch_timeline
  "Under 3 months": "Menos de 3 meses",
  "3-6 months": "3-6 meses",
  "6-12 months": "6-12 meses",
  "12-18 months": "12-18 meses",
  "Over 18 months": "Más de 18 meses",

  // acquisition_channel
  "Online self-service": "Autoservicio online",
  "Direct sales": "Venta directa",
  "Partners or channel": "Socios o canal",
  "Foot traffic or location": "Paso de gente / ubicación",
  "Community or word of mouth": "Comunidad o boca a boca",
  "Paid advertising": "Publicidad de pago",

  // competition
  "Niche with no clear competitors": "Nicho sin competidores claros",
  "Few competitors": "Pocos competidores",
  "Crowded market": "Mercado saturado",
  "Dominated by large players": "Dominado por grandes empresas",

  // capital_intensity
  "Low (digital, near-zero marginal cost)": "Baja (digital, coste marginal casi nulo)",
  Medium: "Media",
  "High (inventory, equipment, premises or R&D)": "Alta (existencias, equipos, local o I+D)",

  // team_requirement
  "Feasible solo": "Se puede llevar en solitario",
  "Small team (2-3)": "Equipo pequeño (2-3)",
  "Large team": "Equipo grande",
  "Specialized profiles required": "Perfiles especializados",

  // time_to_revenue
  Immediate: "Inmediato",
  "0-3 months": "0-3 meses",
  "3-12 months": "3-12 meses",
  "More than 12 months": "Más de 12 meses",

  // regulatory_load
  Light: "Ligera",
  "Moderate (licenses, data protection)": "Moderada (licencias, protección de datos)",
  "Heavy (health, finance, food)": "Fuerte (salud, finanzas, alimentación)",
  "Critical or multi-jurisdiction": "Crítica o en varios países",

  // third_party_dependency
  Autonomous: "Autónomo",
  "Few key partners": "Pocos socios clave",
  "Many partners": "Muchos socios",
  "Depends on a platform": "Depende de una plataforma",
  "Critical dependency": "Dependencia crítica",

  // money_handling
  "No third-party money": "No maneja dinero de terceros",
  "Collects through a payment provider": "Cobra mediante un proveedor de pagos",
  "Holds or intermediates funds": "Custodia o intermedia fondos",

  // rent_level (RENT_LEVELS en figures.ts)
  "Below average": "Por debajo de la media",
  Average: "En la media",
  "Above average": "Por encima de la media",
  "Prime location": "Zona prime",
};

export function hasLabel(value: string) {
  return Object.hasOwn(LABELS, value);
}

/** Lo que se muestra de un valor guardado; si no lo conoce, el valor tal cual (nunca rompe la pantalla). */
export function valueLabel(value: string) {
  return LABELS[value] ?? value;
}