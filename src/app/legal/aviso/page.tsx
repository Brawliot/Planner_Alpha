import type { Metadata } from "next";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Aviso legal" };

export default function AvisoLegalPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">Aviso legal</h1>
      <p className="text-muted-foreground">
        Texto provisional. El aviso legal definitivo se publicará aquí antes del lanzamiento.
      </p>
    </PageContainer>
  );
}