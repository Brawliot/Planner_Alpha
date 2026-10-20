"use client";

import { useState } from "react";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { LogoMark } from "@/components/logo-mark";
import { useIdeaDraft } from "@/components/prompt-form";

type Side = "login" | "registro";

export function AuthCard({ initialSide }: { initialSide: Side }) {
  const [side, setSide] = useState<Side>(initialSide);
  const [flipping, setFlipping] = useState(false);
  // Si viene de escribir su idea en la portada, se la enseñamos: no se ha perdido.
  const idea = useIdeaDraft().trim();

  function flipTo(next: Side) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFlipping(!reducedMotion);
    setSide(next);
    window.history.replaceState(null, "", `/${next}`);
  }

  const face =
    "col-start-1 row-start-1 flex flex-col gap-6 rounded-[1.25rem] border bg-surface p-8 shadow-soft [backface-visibility:hidden]";

  return (
    <div className="w-full max-w-md [perspective:1200px]">
      <div
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget) setFlipping(false);
        }}
        // grid-cols-1 = minmax(0, 1fr): la columna no crece con el contenido (ideas largas sin espacios).
        className={`grid grid-cols-1 transition-transform duration-500 ease-in-out [transform-style:preserve-3d] motion-reduce:transition-none ${
          side === "registro" ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <section
          inert={side !== "login"}
          className={`${face} ${side !== "login" && !flipping ? "invisible" : ""}`}
        >
          <FaceHeader title="Iniciar sesión" subtitle="Entra para seguir con tu idea, tu informe y tu plan." idea={idea} />
          <LoginForm onSwitch={() => flipTo("registro")} />
        </section>

        <section
          inert={side !== "registro"}
          className={`${face} [transform:rotateY(180deg)] ${side !== "registro" && !flipping ? "invisible" : ""}`}
        >
          <FaceHeader
            title="Crear Cuenta"
            subtitle={idea ? "Crea tu cuenta para ver tu informe. Informe y plan en unos 3 minutos." : "Informe y plan en unos 3 minutos."}
            idea={idea}
          />
          <RegisterForm onSwitch={() => flipTo("login")} />
        </section>
      </div>
    </div>
  );
}

function FaceHeader({ title, subtitle, idea }: { title: string; subtitle: string; idea: string }) {
  return (
    <div className="flex flex-col gap-4">
      <LogoMark className="size-8" />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {idea && (
        <p className="line-clamp-2 rounded-md bg-background px-3 py-2 text-sm [overflow-wrap:anywhere]">
          <span className="text-muted-foreground">Tu idea: </span>«{idea}»
        </p>
      )}
    </div>
  );
}