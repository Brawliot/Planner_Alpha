import { buttonStyles } from "@/components/ui/button";

/** Llamada final de la portada: vuelve a la caja de la idea. */
export function LandingCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="relative flex flex-col items-center gap-5 overflow-hidden rounded-[1.5rem] bg-surface px-6 py-16 text-center"
    >
      <div
        aria-hidden="true"
        className="hero-halo pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[600px] max-w-full -translate-x-1/2 -translate-y-1/2"
      />
      <h2 id="cta-title" className="relative text-4xl font-bold tracking-tighter sm:text-5xl">
        ¿Empezamos?
      </h2>
      <a href="#idea" className={buttonStyles("accent", "relative min-h-11 gap-2 px-6")}>
        Escribir mi idea <span aria-hidden="true">↑</span>
      </a>
    </section>
  );
}