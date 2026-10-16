export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-gray-500">La dirección que buscas no existe.</p>
      <a href="/" className="underline">Volver al inicio</a>
    </main>
  );
}