import { Suspense } from "react";
import Link from "next/link";
import { getUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <Suspense fallback={<p className="text-sm text-gray-500">Cargando...</p>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}

async function HomeContent() {
  const user = await getUser();

  if (!user) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Planner</h1>
        <Link href="/login" className="rounded bg-black p-2 text-center text-white">Iniciar sesión</Link>
        <Link href="/registro" className="rounded border p-2 text-center">Crear cuenta</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <p className="text-sm text-gray-500">{user.email}</p>
      <LogoutButton />
    </>
  );
}