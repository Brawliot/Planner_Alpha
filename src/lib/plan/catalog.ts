import { option } from "../report/verdict.ts";
import type { Mold, MoldStep, StepOptions, Text } from "./mold.ts";
import type { Actor } from "./step.ts";

/**
 * Catálogo de moldes. Tanda 1: lo que necesita un negocio sencillo (la cafetería de especialidad)
 * para validar, prepararse y abrir. El orden es la prioridad (desempata el timeline).
 *
 * Reglas:
 * - Costes solo de ejecución (profesionales, tasas). La inversión (obra, equipos, género) ya está
 *   en el coste de arranque del informe: aquí contaría dos veces.
 * - La IA solo redacta, resume, compara o hace listas sobre lo que aporta el usuario; nunca afirma
 *   hechos del mundo (qué competidores hay, qué pide el ayuntamiento): eso es un paso del usuario.
 * - Cada estado tiene un molde sin condiciones (tests/unit/plan-catalog.test.ts).
 */

const t = (en: string, es: string): Text => ({ en, es });

function s(id: string, text: Text, doneWhen: Text, options: StepOptions, extra: Partial<MoldStep> = {}): MoldStep {
  const first = (Object.keys(options) as Actor[])[0];
  return { id, text, doneWhen, options, suggestedActor: first, ...extra };
}

const HOSPITALITY_VENUE = [
  { key: "sector" as const, anyOf: [option("sector", "Hospitality/Food service")] },
  { key: "offering_type" as const, anyOf: [option("offering_type", "Physical venue")] },
];

export const MOLDS: readonly Mold[] = [
  // ---- Validar
  {
    id: "interview_customers",
    department: "product",
    phase: "validate",
    kind: "research",
    title: t("Talk to 10 potential customers", "Habla con 10 clientes potenciales"),
    outcome: t("You know whether the problem is real", "Sabes si el problema es real"),
    needs: [],
    gets: ["problem_confirmed"],
    steps: [
      s("list", t("List 10 people who match your customer", "Haz una lista de 10 personas que encajen con tu cliente"), t("You have 10 names", "Tienes 10 nombres"), { user: { effort: "1_4h" } }),
      s(
        "script",
        t("Prepare 5 questions about their problem, without selling", "Prepara 5 preguntas sobre su problema, sin vender nada"),
        t("You have the questions written", "Tienes las preguntas escritas"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "draft_text" } },
      ),
      s("talk", t("Talk to at least 10 of them", "Habla con al menos 10 de ellas"), t("You have notes from 10 conversations", "Tienes notas de 10 conversaciones"), { user: { effort: "1_3d" } }, { dependsOn: ["list", "script"] }),
      s(
        "summary",
        t("Summarise what repeats in their answers", "Resume lo que se repite en sus respuestas"),
        t("You know if most have the problem", "Sabes si la mayoría tiene el problema"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "research_summary" } },
        { dependsOn: ["talk"] },
      ),
    ],
  },
  {
    id: "demand_test",
    department: "product",
    phase: "validate",
    kind: "check",
    title: t("Test that people will buy", "Prueba que la gente compra"),
    outcome: t("Real customers committed before you invest", "Clientes reales comprometidos antes de invertir"),
    needs: ["problem_confirmed"],
    gets: ["demand_tested"],
    steps: [
      s(
        "format",
        t("Choose a test: pre-sale, pop-up or booking page", "Elige una prueba: preventa, puesto temporal o página de reservas"),
        t("You have chosen the test and its goal", "Has elegido la prueba y su objetivo"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "comparison_table" } },
      ),
      s("prepare", t("Prepare the test", "Prepara la prueba"), t("The test is ready to start", "La prueba está lista para empezar"), { user: { effort: "1_3d" } }, { dependsOn: ["format"] }),
      s("run", t("Run the test", "Haz la prueba"), t("The test has finished", "La prueba ha terminado"), { user: { effort: "1_3d" } }, { dependsOn: ["prepare"] }),
      s("count", t("Count who paid or committed", "Cuenta quién pagó o se comprometió"), t("You know whether you met the goal", "Sabes si llegaste al objetivo"), { user: { effort: "under_1h" } }, { dependsOn: ["run"] }),
    ],
  },
  {
    id: "price_test",
    department: "product",
    phase: "validate",
    kind: "check",
    title: t("Test your price", "Prueba tu precio"),
    outcome: t("You know what customers accept to pay", "Sabes qué precio aceptan tus clientes"),
    needs: ["demand_tested"],
    gets: ["price_tested"],
    steps: [
      s(
        "options",
        t("Set 3 price options", "Fija 3 opciones de precio"),
        t("You have 3 prices to test", "Tienes 3 precios para probar"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "comparison_table" } },
      ),
      s("test", t("Offer them to real customers", "Ofrécelos a clientes reales"), t("You have answers for each price", "Tienes respuestas para cada precio"), { user: { effort: "1_3d" } }, { dependsOn: ["options"] }),
      s("decide", t("Choose your price", "Elige tu precio"), t("You have a price", "Tienes un precio"), { user: { effort: "under_1h" } }, { dependsOn: ["test"] }),
    ],
  },
  {
    id: "map_competitors",
    department: "sales",
    phase: "validate",
    kind: "research",
    title: t("Study your competitors", "Analiza tu competencia"),
    outcome: t("You know who you compete with and how", "Sabes con quién compites y cómo"),
    needs: [],
    gets: ["competitors_mapped"],
    unlocks: "competition",
    steps: [
      s("list", t("List your direct competitors, nearby and online", "Haz la lista de tus competidores directos, cerca y en internet"), t("You have the list", "Tienes la lista"), { user: { effort: "4_8h" } }),
      s(
        "compare",
        t("Compare their offer, prices and reviews", "Compara su oferta, sus precios y sus reseñas"),
        t("You have a comparison table", "Tienes una tabla comparativa"),
        { user: { effort: "4_8h" }, ai: { effort: "under_1h", capability: "comparison_table" } },
        { dependsOn: ["list"] },
      ),
      s("conclude", t("Note how crowded your market is", "Apunta cuánta competencia hay"), t("You can say how crowded it is", "Puedes decir cuánta competencia hay"), { user: { effort: "under_1h" } }, { dependsOn: ["compare"] }),
    ],
  },
  {
    id: "define_differentiator",
    department: "product",
    phase: "validate",
    kind: "decision",
    title: t("Define what makes you different", "Define qué te hace diferente"),
    outcome: t("One clear reason to choose you", "Un motivo claro para elegirte"),
    needs: ["competitors_mapped"],
    gets: ["differentiator_defined"],
    unlocks: "differentiator",
    steps: [
      s(
        "options",
        t("Write 3 ways you could stand out", "Escribe 3 formas de destacar"),
        t("You have 3 options", "Tienes 3 opciones"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "draft_text" } },
      ),
      s("choose", t("Choose one and write it in one sentence", "Elige una y escríbela en una frase"), t("You have your sentence", "Tienes tu frase"), { user: { effort: "under_1h" } }, { dependsOn: ["options"] }),
    ],
  },
  {
    id: "startup_cost",
    department: "finance",
    phase: "validate",
    kind: "research",
    title: t("Work out your startup cost", "Calcula tu coste de arranque"),
    outcome: t("You know how much you need to open", "Sabes cuánto necesitas para abrir"),
    needs: [],
    gets: [],
    unlocks: "startup_cost_eur",
    steps: [
      s(
        "list",
        t("List everything you must pay before opening", "Haz la lista de todo lo que pagas antes de abrir"),
        t("You have the list", "Tienes la lista"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
      ),
      s("quotes", t("Get 2 quotes for the biggest items", "Pide 2 presupuestos de lo más caro"), t("You have the quotes", "Tienes los presupuestos"), { user: { effort: "1_3d" } }, { dependsOn: ["list"] }),
      s("sum", t("Add up a minimum and a maximum", "Suma un mínimo y un máximo"), t("You have the range", "Tienes el rango"), { user: { effort: "under_1h" } }, { dependsOn: ["quotes"] }),
    ],
  },
  {
    id: "fixed_costs",
    department: "finance",
    phase: "validate",
    kind: "research",
    title: t("Work out your monthly fixed costs", "Calcula tus gastos fijos al mes"),
    outcome: t("You know what you spend every month", "Sabes cuánto gastas cada mes"),
    needs: [],
    gets: [],
    unlocks: "monthly_fixed_costs_eur",
    steps: [
      s(
        "list",
        t("List what you will pay every month", "Haz la lista de lo que pagarás cada mes"),
        t("You have the list", "Tienes la lista"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
      ),
      s("figures", t("Get a real figure for each item", "Consigue una cifra real para cada gasto"), t("Every item has a figure", "Cada gasto tiene su cifra"), { user: { effort: "4_8h" } }, { dependsOn: ["list"] }),
      s("sum", t("Add up a minimum and a maximum", "Suma un mínimo y un máximo"), t("You have the range", "Tienes el rango"), { user: { effort: "under_1h" } }, { dependsOn: ["figures"] }),
    ],
  },
  {
    id: "identify_licenses",
    department: "legal",
    phase: "validate",
    kind: "research",
    title: t("Find out which licences you need", "Averigua qué licencias necesitas"),
    outcome: t("A list of licences with their deadlines", "Una lista de licencias con sus plazos"),
    needs: [],
    gets: ["licenses_identified"],
    steps: [
      s(
        "ask",
        t("Ask your town hall or an advisor what your activity needs", "Pregunta en tu ayuntamiento o a un gestor qué necesita tu actividad"),
        t("You have an official answer", "Tienes una respuesta oficial"),
        {
          user: { effort: "1_4h" },
          third_party: { effort: "under_1h", wait: "under_1w", cost: "100_500", thirdParty: "advisor" },
        },
      ),
      s(
        "list",
        t("Write the list with deadlines and costs", "Escribe la lista con plazos y costes"),
        t("You have the list", "Tienes la lista"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
        { dependsOn: ["ask"] },
      ),
    ],
  },

  // ---- Financiarte (tres caminos para lo mismo)
  {
    id: "loan",
    department: "finance",
    phase: "prepare",
    kind: "action",
    title: t("Apply for a loan", "Pide un préstamo"),
    outcome: t("The money you are missing", "El dinero que te falta"),
    needs: ["fact:startup_cost_eur"],
    gets: ["funding_covered"],
    fit: [{ when: { employed: true }, reason: t("A salary makes a loan easier to get", "Con nómina es más fácil que te den un préstamo") }],
    steps: [
      s(
        "plan",
        t("Prepare a simple financial plan", "Prepara un plan financiero sencillo"),
        t("You have the plan", "Tienes el plan"),
        {
          user: { effort: "1_3d" },
          ai: { effort: "1_4h", capability: "draft_text" },
          third_party: { effort: "1_4h", wait: "1_4w", cost: "100_500", thirdParty: "advisor" },
        },
      ),
      s("compare", t("Compare offers from 3 banks", "Compara ofertas de 3 bancos"), t("You know the best offer", "Sabes cuál es la mejor oferta"), { user: { effort: "4_8h" } }, { dependsOn: ["plan"] }),
      s(
        "apply",
        t("Apply and wait for the answer", "Solicítalo y espera la respuesta"),
        t("The loan is approved", "El préstamo está aprobado"),
        { third_party: { effort: "1_4h", wait: "1_4w", thirdParty: "bank" } },
        { dependsOn: ["compare"] },
      ),
    ],
  },
  {
    id: "partner",
    department: "finance",
    phase: "prepare",
    kind: "action",
    title: t("Find a partner or investor", "Busca un socio o inversor"),
    outcome: t("The money you are missing, in exchange for a share", "El dinero que te falta, a cambio de una parte"),
    needs: ["fact:startup_cost_eur"],
    gets: ["funding_covered"],
    fit: [{ when: { hasNetwork: true }, reason: t("You have contacts in the sector", "Tienes contactos en el sector") }],
    steps: [
      s(
        "offer",
        t("Decide how much you ask for and what you offer", "Decide cuánto pides y qué ofreces a cambio"),
        t("You have a clear offer", "Tienes una propuesta clara"),
        { user: { effort: "4_8h" }, third_party: { effort: "1_4h", wait: "under_1w", cost: "100_500", thirdParty: "advisor" } },
      ),
      s("list", t("List 5 people who could join", "Haz una lista de 5 personas que podrían entrar"), t("You have 5 names", "Tienes 5 nombres"), { user: { effort: "1_4h" } }),
      s("pitch", t("Present your project to them", "Preséntales tu proyecto"), t("Someone has said yes", "Alguien ha dicho que sí"), { user: { effort: "1_3d" } }, { dependsOn: ["offer", "list"] }),
      s(
        "sign",
        t("Sign the agreement with a lawyer", "Firma el acuerdo con un abogado"),
        t("The agreement is signed", "El acuerdo está firmado"),
        { third_party: { effort: "1_4h", wait: "1_4w", cost: "500_2000", thirdParty: "lawyer" } },
        { dependsOn: ["pitch"] },
      ),
    ],
  },
  {
    id: "reduce_investment",
    department: "finance",
    phase: "prepare",
    kind: "action",
    title: t("Reduce what you need to open", "Reduce lo que necesitas para abrir"),
    outcome: t("A startup cost your budget covers", "Un coste de arranque que tu presupuesto cubre"),
    needs: ["fact:startup_cost_eur"],
    gets: ["funding_covered"],
    steps: [
      s(
        "split",
        t("Split your costs into essential and later", "Separa tus gastos en imprescindibles y para más adelante"),
        t("Every cost is marked", "Cada gasto está marcado"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
      ),
      s("cheaper", t("Look for second-hand, renting or cheaper options", "Busca segunda mano, renting u opciones más baratas"), t("You have alternatives for the big items", "Tienes alternativas para lo más caro"), { user: { effort: "4_8h" } }, { dependsOn: ["split"] }),
      s("recalc", t("Recalculate and check your budget covers it", "Recalcula y comprueba que tu presupuesto llega"), t("Your budget covers the new cost", "Tu presupuesto cubre el nuevo coste"), { user: { effort: "under_1h" } }, { dependsOn: ["cheaper"] }),
    ],
  },

  // ---- Preparar
  {
    id: "register_business",
    department: "legal",
    phase: "prepare",
    kind: "action",
    title: t("Register your business", "Date de alta"),
    outcome: t("You can invoice legally", "Puedes facturar legalmente"),
    needs: [],
    gets: ["legal_entity_ready"],
    steps: [
      s(
        "form",
        t("Choose between self-employed and a company", "Elige entre autónomo y sociedad"),
        t("You have chosen", "Has elegido"),
        { user: { effort: "1_4h" }, third_party: { effort: "under_1h", wait: "under_1w", cost: "under_100", thirdParty: "advisor" } },
      ),
      s(
        "register",
        t("Register with the tax office and social security", "Date de alta en Hacienda y en la Seguridad Social"),
        t("You have the registration documents", "Tienes los justificantes de alta"),
        { user: { effort: "1_4h" }, third_party: { effort: "under_1h", wait: "under_1w", cost: "100_500", thirdParty: "advisor" } },
        { dependsOn: ["form"] },
      ),
      s("insurance", t("Take out liability insurance", "Contrata un seguro de responsabilidad civil"), t("The policy is active", "La póliza está activa"), { user: { effort: "1_4h", cost: "100_500" } }, { dependsOn: ["register"] }),
    ],
  },
  {
    id: "bank_account",
    department: "finance",
    phase: "prepare",
    kind: "action",
    title: t("Open a business bank account", "Abre la cuenta del negocio"),
    outcome: t("Business money separate from yours", "El dinero del negocio, separado del tuyo"),
    needs: ["legal_entity_ready"],
    gets: ["bank_account_ready"],
    steps: [
      s(
        "compare",
        t("Compare fees from 3 banks", "Compara las comisiones de 3 bancos"),
        t("You have chosen a bank", "Has elegido banco"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "comparison_table" } },
      ),
      s("open", t("Open the account", "Abre la cuenta"), t("The account is open", "La cuenta está abierta"), { third_party: { effort: "1_4h", wait: "under_1w", thirdParty: "bank" } }, { dependsOn: ["compare"] }),
    ],
  },
  {
    id: "find_premises",
    department: "operations",
    phase: "prepare",
    kind: "action",
    title: t("Find and sign your premises", "Busca y firma tu local"),
    outcome: t("A signed premises that allows your activity", "Un local firmado que admite tu actividad"),
    needs: ["funding_covered"],
    gets: ["premises_signed"],
    steps: [
      s(
        "criteria",
        t("Set size, area and maximum rent", "Fija tamaño, zona y alquiler máximo"),
        t("You have your criteria", "Tienes tus criterios"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
      ),
      s("visit", t("Visit at least 5 premises", "Visita al menos 5 locales"), t("You have a favourite", "Tienes un favorito"), { user: { effort: "1_3d" } }, { dependsOn: ["criteria"] }),
      s(
        "check",
        t("Check with the town hall that your activity is allowed there", "Comprueba en el ayuntamiento que tu actividad se permite allí"),
        t("You have confirmation in writing", "Tienes la confirmación por escrito"),
        { user: { effort: "1_4h" }, third_party: { effort: "under_1h", wait: "under_1w", cost: "100_500", thirdParty: "advisor" } },
        { dependsOn: ["visit"] },
      ),
      s(
        "sign",
        t("Negotiate and sign the lease", "Negocia y firma el contrato"),
        t("The lease is signed", "El contrato está firmado"),
        { user: { effort: "4_8h" }, third_party: { effort: "1_4h", wait: "under_1w", cost: "100_500", thirdParty: "lawyer" } },
        { dependsOn: ["check"] },
      ),
    ],
  },
  {
    id: "fit_out",
    department: "operations",
    phase: "prepare",
    kind: "action",
    title: t("Fit out and equip your premises", "Acondiciona y equipa tu local"),
    outcome: t("Premises ready to open", "El local listo para abrir"),
    needs: ["premises_signed", "funding_covered"],
    gets: ["premises_ready"],
    steps: [
      s(
        "plan",
        t("List the works and equipment you need", "Haz la lista de obra y equipos que necesitas"),
        t("You have the list", "Tienes la lista"),
        { user: { effort: "4_8h" }, ai: { effort: "1_4h", capability: "checklist" } },
      ),
      s("quotes", t("Get 3 quotes and choose", "Pide 3 presupuestos y elige"), t("You have hired the works", "Has contratado la obra"), { user: { effort: "4_8h" } }, { dependsOn: ["plan"] }),
      s("works", t("Have the works and installation done", "Haz la obra y la instalación"), t("The works are finished", "La obra está terminada"), { third_party: { effort: "1_4h", wait: "1_3m", thirdParty: "supplier" } }, { dependsOn: ["quotes"] }),
      s("test", t("Set up and test everything", "Monta y prueba todo"), t("Everything works", "Todo funciona"), { user: { effort: "1_3d" } }, { dependsOn: ["works"] }),
    ],
  },
  {
    id: "apply_licenses",
    department: "legal",
    phase: "prepare",
    kind: "action",
    title: t("Apply for your licences", "Pide las licencias de tu actividad"),
    outcome: t("All licences granted", "Todas las licencias concedidas"),
    needs: ["licenses_identified", "legal_entity_ready"],
    gets: ["licenses_granted"],
    steps: [
      s(
        "documents",
        t("Gather the documents for each licence", "Reúne los documentos de cada licencia"),
        t("You have every document", "Tienes todos los documentos"),
        { user: { effort: "4_8h" }, ai: { effort: "under_1h", capability: "checklist" } },
      ),
      s(
        "submit",
        t("Submit the applications", "Presenta las solicitudes"),
        t("Every licence is granted", "Todas las licencias están concedidas"),
        {
          user: { effort: "1_4h", cost: "under_100" },
          third_party: { effort: "1_4h", wait: "1_3m", cost: "100_500", thirdParty: "advisor" },
        },
        { suggestedActor: "third_party", dependsOn: ["documents"] },
      ),
    ],
  },
  {
    id: "hospitality_licenses",
    department: "legal",
    phase: "prepare",
    kind: "action",
    title: t("Get your hospitality licences", "Saca las licencias de hostelería"),
    outcome: t("You can serve food and drink legally", "Puedes servir comida y bebida legalmente"),
    needs: ["legal_entity_ready", "premises_signed"],
    gets: ["licenses_granted"],
    when: { facts: HOSPITALITY_VENUE },
    steps: [
      s(
        "opening",
        t("Apply for the activity and opening licence", "Pide la licencia de actividad y apertura"),
        t("The licence is granted", "La licencia está concedida"),
        { third_party: { effort: "1_4h", wait: "1_3m", cost: "100_500", thirdParty: "public_body" } },
      ),
      s(
        "sanitary",
        t("Register in the health register", "Inscríbete en el registro sanitario"),
        t("You have the registration number", "Tienes el número de registro"),
        { third_party: { effort: "1_4h", wait: "1_4w", cost: "under_100", thirdParty: "public_body" } },
      ),
      s("handler", t("Get the food handler certificate", "Saca el certificado de manipulador de alimentos"), t("You have the certificate", "Tienes el certificado"), { user: { effort: "4_8h", cost: "under_100" } }),
      s(
        "haccp",
        t("Prepare your food safety plan (HACCP)", "Prepara tu plan de higiene (APPCC)"),
        t("The plan is written", "El plan está escrito"),
        { user: { effort: "1_3d" }, third_party: { effort: "1_4h", wait: "1_4w", cost: "100_500", thirdParty: "advisor" } },
      ),
    ],
  },
  {
    id: "build_mvp",
    department: "product",
    phase: "prepare",
    kind: "action",
    title: t("Build your first version", "Construye tu primera versión"),
    outcome: t("A first version real customers can use", "Una primera versión que clientes reales pueden usar"),
    needs: ["problem_confirmed"],
    gets: ["mvp_ready"],
    steps: [
      s(
        "scope",
        t("Choose the minimum features", "Elige las funciones mínimas"),
        t("You have a short list", "Tienes una lista corta"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
      ),
      s(
        "build",
        t("Build it", "Constrúyela"),
        t("It works end to end", "Funciona de principio a fin"),
        { user: { effort: "1_2w" }, third_party: { effort: "1_4h", wait: "1_3m", cost: "2000_10000", thirdParty: "developer" } },
        { skill: "programming", dependsOn: ["scope"] },
      ),
      s("try", t("Try it with 3 customers", "Pruébala con 3 clientes"), t("3 customers have used it", "3 clientes la han usado"), { user: { effort: "4_8h" } }, { dependsOn: ["build"] }),
    ],
  },
  {
    id: "brand",
    department: "sales",
    phase: "prepare",
    kind: "action",
    title: t("Create your brand", "Crea tu marca"),
    outcome: t("A name and a logo", "Un nombre y un logo"),
    needs: [],
    gets: ["brand_ready"],
    steps: [
      s(
        "name",
        t("Choose a name", "Elige un nombre"),
        t("You have a name", "Tienes un nombre"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "draft_text" } },
      ),
      s("check", t("Check that the name is free", "Comprueba que el nombre está libre"), t("Nobody else uses it", "Nadie más lo usa"), { user: { effort: "1_4h" } }, { dependsOn: ["name"] }),
      s(
        "logo",
        t("Get a logo", "Consigue un logo"),
        t("You have the logo files", "Tienes los archivos del logo"),
        { user: { effort: "4_8h" }, third_party: { effort: "1_4h", wait: "1_4w", cost: "100_500", thirdParty: "designer" } },
        { skill: "design", dependsOn: ["check"] },
      ),
    ],
  },
  {
    id: "website",
    department: "sales",
    phase: "prepare",
    kind: "action",
    title: t("Your website", "Tu web"),
    outcome: t("People can find you online", "Te pueden encontrar en internet"),
    needs: [],
    gets: ["website_ready"],
    steps: [
      s(
        "texts",
        t("Write the texts", "Escribe los textos"),
        t("The texts are ready", "Los textos están listos"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "draft_text" } },
      ),
      s(
        "page",
        t("Publish a simple page with your contact details", "Publica una página sencilla con tus datos de contacto"),
        t("The page is online", "La página está en internet"),
        { user: { effort: "4_8h" }, third_party: { effort: "1_4h", wait: "1_4w", cost: "100_500", thirdParty: "developer" } },
        { dependsOn: ["texts"] },
      ),
      s(
        "full",
        t("Add bookings or online sales", "Añade reservas o venta en línea"),
        t("Customers can book or buy online", "Los clientes pueden reservar o comprar en línea"),
        { user: { effort: "1_3d" }, third_party: { effort: "1_4h", wait: "1_4w", cost: "500_2000", thirdParty: "developer" } },
        { level: 3, skill: "programming", dependsOn: ["page"] },
      ),
    ],
  },
  {
    id: "suppliers",
    department: "operations",
    phase: "prepare",
    kind: "action",
    title: t("Choose your suppliers", "Elige tus proveedores"),
    outcome: t("Who supplies you and on what terms", "Quién te suministra y en qué condiciones"),
    needs: [],
    gets: ["suppliers_chosen"],
    steps: [
      s(
        "list",
        t("List what you will buy regularly", "Haz la lista de lo que comprarás a menudo"),
        t("You have the list", "Tienes la lista"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "checklist" } },
      ),
      s("quotes", t("Ask 3 suppliers for prices and terms", "Pide precios y condiciones a 3 proveedores"), t("You have 3 offers", "Tienes 3 ofertas"), { user: { effort: "4_8h" } }, { dependsOn: ["list"] }),
      s(
        "choose",
        t("Compare and agree terms with the best", "Compara y cierra condiciones con el mejor"),
        t("You have your suppliers", "Tienes tus proveedores"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "comparison_table" } },
        { dependsOn: ["quotes"] },
      ),
    ],
  },
  {
    id: "offer_pricing",
    department: "product",
    phase: "prepare",
    kind: "decision",
    title: t("Define your offer and prices", "Define tu oferta y tus precios"),
    outcome: t("What you sell and for how much", "Qué vendes y a cuánto"),
    needs: [],
    gets: ["offer_defined"],
    steps: [
      s(
        "list",
        t("List what you will sell", "Haz la lista de lo que venderás"),
        t("You have the list", "Tienes la lista"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "draft_text" } },
      ),
      s("unit_cost", t("Work out what each item costs you", "Calcula cuánto te cuesta cada cosa"), t("Every item has its cost", "Cada cosa tiene su coste"), { user: { effort: "4_8h" } }, { dependsOn: ["list"] }),
      s("prices", t("Set your prices", "Pon tus precios"), t("Every item has a price", "Cada cosa tiene su precio"), { user: { effort: "1_4h" } }, { dependsOn: ["unit_cost"] }),
      s(
        "write",
        t("Write your final offer or menu", "Escribe tu oferta o carta final"),
        t("The offer is ready to show", "La oferta está lista para enseñar"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "draft_text" } },
        { dependsOn: ["prices"] },
      ),
    ],
  },

  // ---- Lanzar
  {
    id: "first_customers",
    department: "sales",
    phase: "launch",
    kind: "action",
    title: t("Get your first customers", "Consigue tus primeros clientes"),
    outcome: t("Your first sales", "Tus primeras ventas"),
    needs: ["legal_entity_ready", "offer_defined"],
    gets: ["first_customers"],
    steps: [
      s(
        "plan",
        t("Plan your launch", "Planifica tu lanzamiento"),
        t("You have a launch plan with a date", "Tienes un plan de lanzamiento con fecha"),
        { user: { effort: "1_4h" }, ai: { effort: "under_1h", capability: "draft_text" } },
      ),
      s(
        "presence",
        t("Announce it where your customers are", "Anúncialo donde están tus clientes"),
        t("Your announcement is published", "Tu anuncio está publicado"),
        { user: { effort: "4_8h" }, ai: { effort: "1_4h", capability: "draft_text" } },
        { skill: "social_media", dependsOn: ["plan"] },
      ),
      s("network", t("Tell your contacts and invite them", "Cuéntaselo a tus contactos e invítalos"), t("Your contacts know the date", "Tus contactos saben la fecha"), { user: { effort: "1_4h" } }, { dependsOn: ["plan"] }),
      s("launch", t("Open and sell", "Abre y vende"), t("You have made your first sale", "Has hecho tu primera venta"), { user: { effort: "4_8h" } }, { dependsOn: ["presence", "network"] }),
    ],
  },
];