"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!ref.current?.open) {
      ref.current?.showModal();
    }
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label="Acceso a la cuenta"
      onClose={() => router.back()}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="modal-enter m-auto overflow-visible bg-transparent p-0 text-foreground">
      {children}
      {/* Después del contenido: al abrir, el foco va al primer campo y no a "Cerrar". */}
      <button
        type="button"
        onClick={() => ref.current?.close()}
        aria-label="Cerrar"
        className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </dialog>
  );
}