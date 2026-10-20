import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-8 text-sm text-muted-foreground">
        <span>Mando · Planifica y ejecuta tu negocio</span>
        <nav aria-label="Legal">
          <Link href="/legal/aviso" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            Aviso legal
          </Link>
        </nav>
      </div>
    </footer>
  );
}