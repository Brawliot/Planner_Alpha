"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** Botón sin estilo propio: quien lo usa decide su aspecto (hoy, el menú de la cuenta). */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function onClick() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      Cerrar sesión
    </button>
  );
}