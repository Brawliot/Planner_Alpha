"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Pasos orientativos: el análisis es una sola llamada (~17 s) que no informa de su avance.
 * Describen lo que de verdad ocurre en él, pero su momento es aproximado (avanzan por reloj).
 */
const STEPS = [
  { at: 0, label: "Respuestas guardadas" },
  { at: 2, label: "Comprobando lo que sabemos y lo que no" },
  { at: 7, label: "Calculando cifras y fechas" },
  { at: 13, label: "Redactando tu informe" },
] as const;

/** Barra que se frena: nunca pasa del 92 % por sí sola; la completa la llegada del informe. */
function progressAt(seconds: number) {
  return Math.max(4, 92 * (1 - Math.exp(-seconds / 9)));
}

export function AnalysisWait() {
  const [seconds, setSeconds] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    const start = Date.now();
    const timer = setInterval(() => setSeconds((Date.now() - start) / 1000), 500);
    return () => clearInterval(timer);
  }, []);

  const visible = STEPS.filter((step) => step.at <= seconds);

  return (
    <section
      aria-labelledby="analysis-title"
      className="relative flex flex-col items-center gap-8 overflow-hidden rounded-[1.5rem] bg-surface px-6 py-12 text-center shadow-soft"
    >
      <div aria-hidden="true" className="analysis-halo pointer-events-none absolute top-[88px] left-1/2 size-64" />

      <div aria-hidden="true" className="relative flex size-20 items-center justify-center">
        <span className="analysis-ring absolute inset-0 rounded-[1.25rem] border-2 border-accent" />
        <span className="analysis-ring absolute inset-0 rounded-[1.25rem] border-2 border-accent [animation-delay:1.2s]" />
        <svg viewBox="0 0 24 24" className="relative size-16">
          <rect width="24" height="24" rx="6" className="fill-accent" />
          <path d="M12 6l6 6-6 6-6-6z" className="analysis-diamond fill-accent-foreground" />
        </svg>
      </div>

      <div className="relative flex flex-col gap-2">
        <h1
          id="analysis-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-bold tracking-tighter outline-none sm:text-4xl"
        >
          Analizando tu idea
        </h1>
        <p className="text-muted-foreground">Suele tardar unos 20 segundos. No cierres la página.</p>
      </div>

      {/* Sin aria-valuenow: no conocemos el progreso real (indeterminado para el lector). */}
      <div
        role="progressbar"
        aria-label="Análisis en curso"
        aria-busy="true"
        className="relative h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
      >
        <div
          className="analysis-bar relative h-full overflow-hidden rounded-full bg-accent transition-[width] duration-500 ease-linear motion-reduce:transition-none"
          style={{ width: `${progressAt(seconds)}%` }}
        />
      </div>

      <ol aria-live="polite" className="relative flex w-full max-w-md flex-col gap-3 text-left text-sm">
        {visible.map((step, index) => {
          const current = index === visible.length - 1;
          return (
            <li
              key={step.label}
              className={cn("analysis-step flex items-center gap-3", current ? "font-medium" : "text-muted-foreground")}
            >
              {current ? (
                <span aria-hidden="true" className="analysis-spinner size-5 shrink-0 rounded-full border-2 border-muted border-t-accent" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground"
                >
                  ✓
                </span>
              )}
              {step.label}
              {current && "…"}
            </li>
          );
        })}
      </ol>
    </section>
  );
}