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
    </dialog>
  );
}