"use client";

import { useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { inputStyles } from "./field";

type PasswordFieldProps = Omit<ComponentProps<"input">, "type"> & { label: string; hint?: string };

/** Contraseña con botón para mostrarla y una pista visible (p. ej. la longitud mínima) antes de fallar. */
export function PasswordField({ label, hint, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-input`} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={`${id}-input`}
          type={visible ? "text" : "password"}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(inputStyles, "w-full pr-12", className)}
          {...props}
        />
        {/* "clave" y no "contraseña": así getByLabel("Contraseña") sigue encontrando solo el campo. */}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar clave" : "Mostrar clave"}
          aria-controls={`${id}-input`}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}