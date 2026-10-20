const FAQ = [
  {
    q: "¿Qué hacéis con mi idea?",
    a: "La guardamos en tu cuenta para preparar tu informe y tu plan; solo tú puedes verla. Para analizarla, se envía a servicios de inteligencia artificial.",
  },
  {
    q: "¿Lo hace una IA?",
    a: "En parte. La IA clasifica tu idea y redacta textos. Las cifras y las fechas las calcula el código, y lo que redacta la IA va marcado y no cuenta como hecho hasta que tú lo validas.",
  },
  {
    q: "¿Sirve para cualquier negocio?",
    a: "Puedes escribir cualquier idea. El catálogo de tareas del plan sigue creciendo: en algunos sectores (licencias concretas, contratar empleados…) el plan todavía puede quedarse corto.",
  },
  {
    q: "¿Cuánto se tarda?",
    a: "Escribir la idea y responder unas preguntas lleva unos minutos. El análisis, unos segundos.",
  },
] as const;

/** Preguntas frecuentes de la portada (sin sesión). Acordeones nativos: teclado y lector sin JS. */
export function LandingFaq() {
  return (
    <section aria-labelledby="faq-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-20">
      <h2 id="faq-title" className="text-center text-4xl font-bold tracking-tighter">
        Preguntas frecuentes
      </h2>
      <div className="flex flex-col gap-2">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group rounded-[1rem] bg-surface px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {q}
              <span
                aria-hidden="true"
                className="text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              >
                ▾
              </span>
            </summary>
            <p className="pb-5 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}