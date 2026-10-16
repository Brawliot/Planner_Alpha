import { Suspense } from "react";
import Link from "next/link";
import { getUser } from "@/lib/session";
import { buttonStyles } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";

export default function Home() {
  return (
    <PageContainer size="sm" centered>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        <HomeContent />
      </Suspense>
    </PageContainer>
  );
}

async function HomeContent() {
  const user = await getUser();

  if (!user) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Mando</h1>
        <Link href="/login" className={buttonStyles("primary")}>Iniciar sesión</Link>
        <Link href="/registro" className={buttonStyles("secondary")}>Crear cuenta</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <p className="text-sm text-muted-foreground">{user.email}</p>
    </>
  );
}