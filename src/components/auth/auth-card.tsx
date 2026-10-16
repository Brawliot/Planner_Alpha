"use client";

import { useState } from "react";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

type Side = "login" | "registro";

export function AuthCard({ initialSide }: { initialSide: Side }) {
  const [side, setSide] = useState<Side>(initialSide);
  const [flipping, setFlipping] = useState(false);

  function flipTo(next: Side) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFlipping(!reducedMotion);
    setSide(next);
    window.history.replaceState(null, "", `/${next}`);
  }

  const face =
    "col-start-1 row-start-1 flex flex-col gap-6 rounded-2xl border bg-background p-6 shadow-lg [backface-visibility:hidden]";

  return (
    <div className="w-full max-w-sm [perspective:1200px]">
      <div
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget) setFlipping(false);
        }}
        className={`grid transition-transform duration-500 ease-in-out [transform-style:preserve-3d] motion-reduce:transition-none ${
          side === "registro" ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <section
          inert={side !== "login"}
          className={`${face} ${side !== "login" && !flipping ? "invisible" : ""}`}
        >
          <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
          <LoginForm onSwitch={() => flipTo("registro")} />
        </section>

        <section
          inert={side !== "registro"}
          className={`${face} [transform:rotateY(180deg)] ${side !== "registro" && !flipping ? "invisible" : ""}`}
        >
          <h2 className="text-2xl font-semibold">Crear cuenta</h2>
          <RegisterForm onSwitch={() => flipTo("login")} />
        </section>
      </div>
    </div>
  );
}