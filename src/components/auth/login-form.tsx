"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

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
        <Field label="Email" name="email" type="email" required maxLength={254} autoComplete="email" />
        <PasswordField label="Contraseña" name="password" required maxLength={128} autoComplete="current-password" />

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <Button type="submit" variant="accent" disabled={loading} className="min-h-11 w-full">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="text-sm">
        ¿No tienes cuenta?{" "}
        <Button variant="link" onClick={onSwitch}>Regístrate</Button>
      </p>
    </div>
  );

}