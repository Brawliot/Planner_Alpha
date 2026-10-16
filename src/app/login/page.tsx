import { AuthCard } from "@/components/auth/auth-card";
import type { Metadata } from "next";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <PageContainer centered className="items-center">
      <AuthCard initialSide="login" />
    </PageContainer>
  );
}