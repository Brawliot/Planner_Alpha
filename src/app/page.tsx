import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <Suspense fallback={<p className="text-sm text-gray-500">Cargando...</p>}>
        <UserPanel />
      </Suspense>
    </main>
  );
}

async function UserPanel() {
  const user = await requireUser();

  return (
    <>
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <p className="text-sm text-gray-500">{user.email}</p>
      <LogoutButton />
    </>
  );
}