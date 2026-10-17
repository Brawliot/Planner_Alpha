import type { JevQuestion } from "../jev.ts";
import { certaintyOf, NOT_DECIDED, NOT_SPECIFIED } from "./certainty.ts";
import type { Fact } from "./facts.ts";

type ChoiceQuestion = Extract<JevQuestion, { type: "choice" }>;

export const ONLY_IF_SUPPORTED =
  'Choose an option only if user_text supports it; otherwise choose "Not specified".';
const NOT_SPECIFIED_OPTION = { "Not specified": "user_text does not say" };

/** Tema de cada pregunta: agrupa las preguntas al usuario y, más adelante, las áreas del informe. */
export type Topic = "business" | "market" | "founder" | "resources" | "risk";

export const TOPIC_TITLES: Record<Topic, string> = {
  business: "Your business",
  market: "Your market",
  founder: "You",
  resources: "Resources and timing",
  risk: "Risks",
};

interface CatalogEntry {
  topic: Topic;
  /** ask: si no se sabe, se pregunta al usuario. infer: si no se sabe, lo infiere GPT. */
  mode: "ask" | "infer";
  /** Cómo se le pregunta al usuario (null en las que no se preguntan). */
  prompt: string | null;
  jev: ChoiceQuestion;
}

/**
 * Catálogo de preguntas de clasificación. Los umbrales de certainty.ts se calibraron con este texto
 * exacto: si cambias instrucciones u opciones, vuelve a ejecutar npm run calibrate:jev.
 */
export const CATALOG = {
  sector: {
    topic: "business",
    mode: "ask",
    prompt: "What sector is your business in?",
    jev: {
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
  },
  offering_type: {
    topic: "business",
    mode: "ask",
    prompt: "What do you offer?",
    jev: {
      type: "choice",
      instructions: `What does the business offer? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Physical product": "Tangible goods or merchandise",
        Software: "Application, SaaS or digital software",
        "People-delivered service": "A service delivered by people",
        "Platform or marketplace": "A platform connecting buyers and sellers",
        "Content or media": "Digital or physical content",
        "Hardware plus software": "A combination of device and software",
        "Physical venue": "A location-based business such as a shop, gym or restaurant",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  revenue_model: {
    topic: "business",
    mode: "ask",
    prompt: "How will you make money?",
    jev: {
      type: "choice",
      instructions: `How does the business make money? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        Subscription: "Recurring monthly or annual fees",
        "One-time sale": "Customers pay once for each purchase: a product, a meal, a service or a license",
        "Transaction commission": "A commission on transactions between other parties",
        "Usage-based": "Fees based on usage or consumption",
        Advertising: "Revenue from ads shown to users",
        Freemium: "A free tier with paid premium features",
        "Services by hours or projects": "Hourly rates or project-based fees",
        Licensing: "Licensing of intellectual property or patents",
        Hybrid: "Several revenue streams combined",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  customer_segment: {
    topic: "market",
    mode: "ask",
    prompt: "Who are your customers?",
    jev: {
      type: "choice",
      instructions: `Who is the customer? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        Consumers: "Individual consumers or households",
        "Small businesses (1-50)": "Small businesses with 1 to 50 employees",
        "Medium businesses (51-250)": "Medium businesses with 51 to 250 employees",
        "Large businesses (250+)": "Large businesses with more than 250 employees",
        "Public sector": "Government or public agencies",
        Nonprofits: "Nonprofit or charitable organizations",
        "Two-sided marketplace": "Both buyers and sellers or service providers",
        "Mixed segments": "Several customer types",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  geographic_scope: {
    topic: "market",
    mode: "ask",
    prompt: "Where will your business operate?",
    jev: {
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
  },
  differentiator: {
    topic: "market",
    mode: "ask",
    prompt: "What sets you apart?",
    jev: {
      type: "choice",
      instructions: `What sets the business apart from alternatives? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Technology or IP": "Proprietary technology or intellectual property",
        Price: "Clearly lower or clearly premium pricing",
        "Quality or experience": "A better product or customer experience",
        "Specialized niche": "A focus on an underserved niche",
        "Convenience or speed": "Faster or more convenient than alternatives",
        Brand: "A strong brand or reputation",
        "Network effect": "Value grows as more users or participants join",
        "None identified": "user_text says it has no clear advantage or copies existing offers",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  founder_experience: {
    topic: "founder",
    mode: "ask",
    prompt: "How much experience do you have in this sector?",
    jev: {
      type: "choice",
      instructions: `How much experience does the founder (the user) have in this business's sector? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        None: "Has never worked in this sector",
        "Under 2 years": "Less than 2 years in this sector",
        "2-5 years": "From 2 up to 5 years in this sector, both included",
        "Over 5 years": "More than 5 years in this sector",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  founder_profile: {
    topic: "founder",
    mode: "ask",
    prompt: "What are your main skills?",
    jev: {
      type: "choice",
      instructions: `What can the founder (the user) do themselves? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        Technical: "Technical skills such as engineering, coding or design",
        Commercial: "Sales and business development skills",
        "Sector expert": "Deep professional expertise in the business's industry",
        Management: "Leadership and team management experience",
        "Several areas": "Skills in several of these areas",
        "No relevant background": "Minimal relevant background or skills",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  time_commitment: {
    topic: "founder",
    mode: "ask",
    prompt: "How much time can you dedicate?",
    jev: {
      type: "choice",
      instructions: `How much time will the founder (the user) dedicate to the business? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Under 10 h/week": "Less than 10 hours a week",
        "10-20 h/week": "From 10 up to 20 hours a week, both included",
        "20-40 h/week": "More than 20 and less than 40 hours a week",
        "Full time": "Full-time dedication: 40 hours a week or more",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  budget_band: {
    topic: "resources",
    mode: "ask",
    prompt: "How much can you invest to start?",
    jev: {
      type: "choice",
      instructions: `How much money is available to start the business? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Under €5k": "Up to 5,000 euros",
        "€5k-€20k": "More than 5,000 and up to 20,000 euros",
        "€20k-€50k": "More than 20,000 and up to 50,000 euros",
        "€50k-€150k": "More than 50,000 and up to 150,000 euros",
        "€150k-€500k": "More than 150,000 and up to 500,000 euros",
        "Over €500k": "More than 500,000 euros",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  validation_stage: {
    topic: "resources",
    mode: "ask",
    prompt: "How far along is your idea?",
    jev: {
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
  },
  launch_timeline: {
    topic: "resources",
    mode: "ask",
    prompt: "When do you want to launch?",
    jev: {
      type: "choice",
      instructions: `When does the user plan to launch the business? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Under 3 months": "Less than 3 months",
        "3-6 months": "From 3 up to 6 months, both included",
        "6-12 months": "More than 6 and up to 12 months",
        "12-18 months": "More than 12 and up to 18 months",
        "Over 18 months": "More than 18 months",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  acquisition_channel: {
    topic: "market",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `How will the business get customers? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Online self-service": "Customers find and buy online on their own",
        "Direct sales": "A sales team sells directly to customers",
        "Partners or channel": "Through resellers or partner networks",
        "Foot traffic or location": "The physical location attracts customers",
        "Community or word of mouth": "Referrals and community growth",
        "Paid advertising": "Paid ads online or offline",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  competition: {
    topic: "market",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `What is the competition like? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Niche with no clear competitors": "A unique market with minimal competition",
        "Few competitors": "A small number of established competitors",
        "Crowded market": "Many competitors in the space",
        "Dominated by large players": "Large companies dominate the market",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  capital_intensity: {
    topic: "resources",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `How much capital does the business need? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Low (digital, near-zero marginal cost)": "Minimal capital requirements",
        Medium: "Moderate capital investment",
        "High (inventory, equipment, premises or R&D)": "Significant capital for assets or R&D",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  team_requirement: {
    topic: "resources",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `What team does the business need? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "Feasible solo": "Can be run by one person",
        "Small team (2-3)": "Needs a small team of 2 or 3 people",
        "Large team": "Needs a team of 4 or more people",
        "Specialized profiles required": "Needs people with specific licensed or rare expertise",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  time_to_revenue: {
    topic: "resources",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `How long until the first revenue? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        Immediate: "First revenue within the first month",
        "0-3 months": "First revenue after more than 1 and up to 3 months",
        "3-12 months": "First revenue after more than 3 and up to 12 months",
        "More than 12 months": "First revenue after more than 12 months",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  regulatory_load: {
    topic: "risk",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `How regulated is the business? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        None: "No regulatory requirements",
        Light: "Minimal regulatory requirements",
        "Moderate (licenses, data protection)": "Licenses or data protection compliance",
        "Heavy (health, finance, food)": "Strict regulation in health, finance or food",
        "Critical or multi-jurisdiction": "Very strict or cross-border regulation",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  third_party_dependency: {
    topic: "risk",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `How much does the business depend on third parties? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        Autonomous: "Operates independently",
        "Few key partners": "Depends on a few key partners",
        "Many partners": "Needs many partner relationships",
        "Depends on a platform": "Relies on a third-party platform",
        "Critical dependency": "Critically depends on a single provider",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
  money_handling: {
    topic: "risk",
    mode: "infer",
    prompt: null,
    jev: {
      type: "choice",
      instructions: `Does the business handle other people's money? ${ONLY_IF_SUPPORTED}`,
      criteria: {
        "No third-party money": "Does not handle customer funds",
        "Collects through a payment provider": "Charges customers through a provider such as Stripe or PayPal",
        "Holds or intermediates funds": "Holds or manages customer funds",
        ...NOT_SPECIFIED_OPTION,
      },
    },
  },
} satisfies Record<string, CatalogEntry>;

export type QuestionKey = keyof typeof CATALOG;
export const QUESTION_KEYS = Object.keys(CATALOG) as QuestionKey[];

/** Todas las preguntas del catálogo en el formato de Jev (la calibración las mide todas). */
export const CATALOG_JEV_QUESTIONS = Object.fromEntries(
  QUESTION_KEYS.map((key) => [key, CATALOG[key].jev]),
) as { [K in QuestionKey]: (typeof CATALOG)[K]["jev"] };

// ---- Preguntas al usuario: un tema por pantalla, solo las que Jev no sabe.

/** Temas que se le preguntan al usuario, en orden. Cada uno tiene 3 preguntas "ask". */
export const ASK_TOPICS = ["business", "market", "founder", "resources"] as const satisfies readonly Topic[];
export type AskTopic = (typeof ASK_TOPICS)[number];

const ASK_KEYS = QUESTION_KEYS.filter((key) => CATALOG[key].mode === "ask");

function askKeysOf(topic: Topic) {
  return ASK_KEYS.filter((key) => CATALOG[key].topic === topic);
}

/** Decisiones que el usuario puede no haber tomado aún: admiten "Not decided yet". */
export const UNDECIDED_KEYS: readonly QuestionKey[] = ["budget_band", "launch_timeline", "time_commitment"];

/**
 * Opciones para el usuario: todas menos "Not specified". En las decisiones pendientes, además,
 * "Not decided yet": obligar a elegir convertiría en sabido algo que el usuario no ha decidido.
 */
export function answerOptions(key: QuestionKey) {
  const options = Object.keys(CATALOG[key].jev.criteria).filter((option) => option !== NOT_SPECIFIED);
  return UNDECIDED_KEYS.includes(key) ? [...options, NOT_DECIDED] : options;
}

export function promptFor(key: QuestionKey) {
  return CATALOG[key].prompt ?? key;
}

export function pendingQuestions(facts: readonly Fact[]): QuestionKey[] {
  return ASK_KEYS.filter((key) => {
    const fact = facts.find((f) => f.key === key);
    // Lo que respondió el usuario no se vuelve a preguntar, aunque sea "Not decided yet".
    return !fact || (fact.source.origin !== "user" && certaintyOf(fact) !== "known");
  });
}

export interface QuestionStep {
  topic: AskTopic;
  title: string;
  /** Solo las preguntas pendientes de ese tema. */
  keys: QuestionKey[];
  /** Posición estable: cuenta los temas ya respondidos por el usuario y los pendientes. */
  index: number;
  total: number;
}

/** Tema que toca responder ahora, o null si no queda nada por preguntar. */
export function currentStep(facts: readonly Fact[]): QuestionStep | null {
  const pending = pendingQuestions(facts);
  const answeredByUser = (key: QuestionKey) => facts.some((f) => f.key === key && f.source.origin === "user");

  // Temas que el usuario ha tenido o tiene que responder; los que Jev sabía enteros no cuentan.
  const involved = ASK_TOPICS.filter((topic) =>
    askKeysOf(topic).some((key) => pending.includes(key) || answeredByUser(key)),
  );
  const topic = involved.find((t) => askKeysOf(t).some((key) => pending.includes(key)));
  if (!topic) return null;

  return {
    topic,
    title: TOPIC_TITLES[topic],
    keys: pending.filter((key) => CATALOG[key].topic === topic),
    index: involved.indexOf(topic) + 1,
    total: involved.length,
  };
}

/** Con preguntas pendientes se pregunta; si no, toca completar el análisis (GPT + Jev). */
export function nextStatus(facts: readonly Fact[]) {
  return pendingQuestions(facts).length > 0 ? "questions" : "analysis";
}

export type AnswersResult = { ok: true; facts: Fact[] } | { ok: false; error: string };

/** Valida en servidor las respuestas a las preguntas del paso y las convierte en datos del usuario. */
export function parseAnswers(keys: readonly QuestionKey[], get: (name: string) => unknown): AnswersResult {
  const facts: Fact[] = [];
  for (const key of keys) {
    const value = get(key);
    if (typeof value !== "string" || !answerOptions(key).includes(value)) {
      return { ok: false, error: "Answer all the questions." };
    }
    // En una respuesta cerrada, la cita es la opción que eligió el usuario.
    facts.push({ key, value, source: { origin: "user", quote: value } });
  }
  return { ok: true, facts };
}

/** Sustituye los datos de las mismas claves y conserva el resto. */
export function mergeFacts(current: readonly Fact[], updates: readonly Fact[]): Fact[] {
  const keys = new Set(updates.map((f) => f.key));
  return [...current.filter((f) => !keys.has(f.key)), ...updates];
}