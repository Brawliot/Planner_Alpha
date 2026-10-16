import { Suspense } from "react";
import Link from "next/link";
import { getUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";
import { buttonStyles } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
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
        <h1 className="text-2xl font-semibold">Mando</h1>
        <Link href="/login" className={buttonStyles("primary")}>Iniciar sesión</Link>
        <Link href="/registro" className={buttonStyles("secondary")}>Crear Cuenta</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <p className="text-sm text-muted-foreground">{user.email}</p>
      <LogoutButton />
    </>
  );
}