import { RegisterForm } from "@/components/auth/register-form";

export default function RegistroPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <RegisterForm />
    </main>
  );
}