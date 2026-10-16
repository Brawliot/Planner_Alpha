import { AuthCard } from "@/components/auth/auth-card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crear Cuenta" };

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthCard initialSide="registro" />
    </main>
  );
}