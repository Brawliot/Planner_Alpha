import { AuthCard } from "@/components/auth/auth-card";

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthCard initialSide="registro" />
    </main>
  );
}