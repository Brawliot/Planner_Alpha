"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ onSwitch }: { onSwitch?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setLoading(false);
    if (error) {
      setError(
        error.status === 429
          ? "Demasiados intentos. Espera un minuto y vuelve a probar."
          : !error.status || error.status >= 500
            ? "No hemos podido conectar. Inténtalo de nuevo en unos segundos."
            : "Email o contraseña incorrectos",
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
          Email
          <input name="email" type="email" required maxLength={254} autoComplete="email" className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1">
          Contraseña
          <input name="password" type="password" required maxLength={128} autoComplete="current-password" className="rounded border p-2" />
        </label>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="rounded bg-foreground p-2 text-background disabled:opacity-50">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-sm">
        ¿No tienes cuenta?{" "}
        {onSwitch ? (
          <button type="button" onClick={onSwitch} className="underline">Regístrate</button>
        ) : (
          <a href="/registro" className="underline">Regístrate</a>
        )}
      </p>
    </div>
  );
}