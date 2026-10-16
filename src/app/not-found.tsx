import Link from "next/link";
import type { Metadata } from "next";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <PageContainer size="sm" centered>
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">La dirección que buscas no existe.</p>
      <Link href="/" className="underline">Volver al inicio</Link>
    </PageContainer>
  );
}