"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer size="sm" centered>
      <h1 className="text-2xl font-semibold">Algo ha fallado</h1>
      <p className="text-sm text-muted-foreground">
        No hemos podido cargar esta página. Puede ser un problema momentáneo.
      </p>
      <Button onClick={() => retry()}>Reintentar</Button>
    </PageContainer>
  );
}