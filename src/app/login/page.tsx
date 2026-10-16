"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
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
          : "Email o contraseña incorrectos",
      );
      return;
    }
    router.push("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>

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

        <button type="submit" disabled={loading} className="rounded bg-black p-2 text-white disabled:opacity-50">
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-sm"> 
            ¿No tienes cuenta? <a href="/registro" className="underline">Regístrate</a>
        </p>
      </form>
    </main>
  );
}