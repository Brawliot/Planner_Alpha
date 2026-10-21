import Link from "next/link";
import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { getUser } from "@/lib/session";
import { buttonStyles } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { LogoMark } from "@/components/logo-mark";
import { HeaderContext } from "@/components/header-context";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold">
            <LogoMark />
            Mando
          </Link>
          {/* usePathname en rutas con parámetros dinámicos: con cacheComponents necesita Suspense. */}
          <Suspense fallback={null}>
            <HeaderContext />
          </Suspense>
        </div>
        {/* Hueco reservado mientras carga la sesión: la cabecera no cambia de forma. */}
        <Suspense fallback={<div aria-hidden="true" className="size-9 rounded-full bg-muted" />}>
          <HeaderUser />
        </Suspense>
      </div>
    </header>
  );
}

async function HeaderUser() {
  let user;
  try {
    user = await getUser();
  } catch (err) {
    unstable_rethrow(err);
    // La cabecera no es crítica: si la BD falla, la página sigue siendo usable.
    console.error(err);
    return <AuthLinks />;
  }

  if (!user) return <AuthLinks />;

  return <UserMenu name={user.name} lastName={user.lastName} email={user.email} />;
}

function AuthLinks() {
  return (
    <div className="flex items-center gap-1">
      <Link href="/login" className="inline-flex min-h-11 items-center px-3 text-sm font-medium underline-offset-4 hover:underline">
        Iniciar sesión
      </Link>
      <Link href="/registro" className={buttonStyles("accent", "min-h-11")}>
        Empezar
      </Link>
    </div>
  );
}