import { AuthCard } from "@/components/auth/auth-card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthCard initialSide="login" />
    </main>
  );
}