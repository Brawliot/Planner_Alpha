"use client";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 384, margin: "20vh auto", padding: 24 }}>
        <h1>Algo ha fallado</h1>
        <p>La aplicación no ha podido cargar. Inténtalo de nuevo en unos segundos.</p>
        <button onClick={() => retry()}>Reintentar</button>
      </body>
    </html>
  );
}