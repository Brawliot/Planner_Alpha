"use client";

import { useActionState, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createReport, type FormState } from "@/app/actions/report";
import { IDEA_MAX_LENGTH } from "@/lib/report/idea";
import { Button } from "@/components/ui/button";

const initialState: FormState = { error: null };

// Borrador en este navegador: si hay que iniciar sesión antes de enviar, la idea no se pierde.
const DRAFT_KEY = "mando:borrador-idea";

function readDraft() {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(value: string) {
  try {
    if (value) window.localStorage.setItem(DRAFT_KEY, value);
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Almacenamiento bloqueado (modo privado estricto): se sigue sin borrador.
  }
}

/** Al cerrar sesión: la idea no debe quedar a la vista de quien use después este navegador. */
export function clearIdeaDraft() {
  writeDraft("");
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Borrador de la idea en este navegador ("" en el servidor). También lo lee el popup de acceso. */
export function useIdeaDraft() {
  return useSyncExternalStore(subscribe, readDraft, () => "");
}

const EXAMPLES = [
  { label: "Cafetería", idea: "Una cafetería de especialidad con tostado propio en mi barrio", Icon: CupIcon },
  { label: "Tienda online", idea: "Una tienda online de cerámica hecha a mano", Icon: BagIcon },
  { label: "Academia", idea: "Una academia de idiomas para niños", Icon: CapIcon },
] as const;

export function PromptForm({ signedIn }: { signedIn: boolean }) {
  // En el servidor no hay borrador; en el navegador se lee sin desajuste de hidratación.
  const draft = useIdeaDraft();
  const router = useRouter();
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? draft;
  const [state, formAction, pending] = useActionState(createReport, initialState);
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function change(value: string) {
    setTyped(value);
    writeDraft(value);
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <form
        action={formAction}
        onSubmit={(e) => {
          // Sin sesión: no se llama al servidor; se abre el popup de registro (navegación interceptada).
          // La idea queda en el borrador. Sin JS, la acción sigue redirigiendo a /login.
          if (!signedIn) {
            e.preventDefault();
            router.push("/registro");
            return;
          }
          // Con sesión, la idea se envía de verdad: el borrador ya no hace falta.
          writeDraft("");
        }}
        className="w-full max-w-2xl text-left"
      >
        <div className="glow-border flex flex-col gap-3 rounded-[1.25rem] bg-background p-5">
          <label htmlFor="idea" className="sr-only">
            Tu idea
          </label>
          <textarea
            ref={textareaRef}
            // Id fijo: la llamada final de la portada enlaza a #idea (solo hay una caja por página).
            id="idea"
            name="idea"
            value={text}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => {
              // Intro envía, como en un chat; Mayús+Intro hace salto de línea.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (text.trim() && !pending) e.currentTarget.form?.requestSubmit();
              }
            }}
            required
            maxLength={IDEA_MAX_LENGTH}
            rows={4}
            autoComplete="off"
            placeholder="Ej.: Una cafetería de especialidad en Valencia, con tostado propio"
            aria-describedby={`${id}-count`}
            className="min-h-28 w-full resize-none bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-3">
            <span id={`${id}-count`} className="text-xs text-muted-foreground tabular-nums">
              {text.length} / {IDEA_MAX_LENGTH}
            </span>
            <Button type="submit" variant="accent" disabled={!text.trim() || pending} className="min-h-11 gap-2">
              {pending ? (
                "Creando…"
              ) : (
                <>
                  Empezar <span aria-hidden="true">→</span>
                </>
              )}
            </Button>
          </div>
        </div>
        <p aria-live="polite" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      </form>

      <ul aria-label="Ideas de ejemplo" className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map(({ label, idea, Icon }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                change(idea);
                textareaRef.current?.focus();
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm shadow-soft transition-colors hover:bg-muted"
            >
              <Icon />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const iconProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "size-4 text-muted-foreground",
} as const;

function CupIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 3v3M12 3v3" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function CapIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c3 2 9 2 12 0v-5" />
    </svg>
  );
}