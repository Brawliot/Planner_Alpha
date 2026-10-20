import { LogoutButton } from "@/components/auth/logout-button";
import { initials } from "@/lib/initials";

const MENU_ID = "menu-cuenta";

/**
 * Menú de la cuenta con la Popover API nativa: el navegador lo abre, lo cierra al pulsar fuera
 * o con Escape y devuelve el foco al avatar. Sin JS propio salvo cerrar sesión.
 */
export function UserMenu({ name, lastName, email }: { name: string; lastName?: string | null; email: string }) {
  const fullName = [name, lastName?.trim()].filter(Boolean).join(" ");

  return (
    <>
      <button
        type="button"
        popoverTarget={MENU_ID}
        aria-label={`Cuenta de ${fullName}`}
        className="flex size-11 items-center justify-center rounded-full"
      >
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {initials(name, lastName)}
        </span>
      </button>

      <div
        id={MENU_ID}
        popover="auto"
        // El popover nativo va centrado por defecto: se coloca bajo el avatar, alineado con el contenido (max-w-6xl).
        className="fixed top-16 right-[max(1rem,calc((100vw-72rem)/2+1.5rem))] bottom-auto left-auto m-0 w-64 rounded-lg border bg-background p-2 text-foreground shadow-lg"
      >
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
        <hr className="my-1" />
        <LogoutButton className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-muted" />
      </div>
    </>
  );
}