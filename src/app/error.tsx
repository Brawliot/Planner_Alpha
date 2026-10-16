"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Algo ha fallado</h1>
      <p className="text-sm text-muted-foreground">
        No hemos podido cargar esta página. Puede ser un problema momentáneo.
      </p>
      <button onClick={() => retry()} className="rounded bg-primary p-2 text-primary-foreground">
        Reintentar
      </button>
    </main>
  );
}