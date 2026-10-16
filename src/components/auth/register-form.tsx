"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
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
        <Field label="Nombre" name="name" required maxLength={100} autoComplete="name" />
        <Field label="Email" name="email" type="email" required maxLength={254} autoComplete="email" />
        <Field label="Contraseña" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="text-sm">
        ¿Ya tienes cuenta?{" "}
        <Button variant="link" onClick={onSwitch}>Inicia sesión</Button>
      </p>
    </div>
  );
}