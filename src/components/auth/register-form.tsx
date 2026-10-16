"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function RegisterForm({ onSwitch }: { onSwitch?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setLoading(false);
    if (error) {
      setError(
        !error.status || error.status >= 500
          ? "No hemos podido conectar. Inténtalo de nuevo en unos segundos."
          : (error.message ?? "No se pudo crear la cuenta"),
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Nombre
          <input name="name" required maxLength={100} autoComplete="name" className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1">
          Email
          <input name="email" type="email" required maxLength={254} autoComplete="email" className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1">
          Contraseña
          <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className="rounded border p-2" />
        </label>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="rounded bg-foreground p-2 text-background disabled:opacity-50">
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p className="text-sm">
        ¿Ya tienes cuenta?{" "}
        {onSwitch ? (
          <button type="button" onClick={onSwitch} className="underline">Inicia sesión</button>
        ) : (
          <a href="/login" className="underline">Inicia sesión</a>
        )}
      </p>
    </div>
  );
}