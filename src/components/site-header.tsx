import Link from "next/link";
import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { getUser } from "@/lib/session";
import { buttonStyles } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="font-semibold">
          Mando
        </Link>
        <Suspense fallback={null}>
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

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{user.name}</span>
      <LogoutButton />
    </div>
  );
}

function AuthLinks() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className={buttonStyles("secondary")}>
        Iniciar sesión
      </Link>
      <Link href="/registro" className={buttonStyles("primary")}>
        Crear cuenta
      </Link>
    </div>
  );
}