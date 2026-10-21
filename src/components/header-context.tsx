"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PLAN_ROUTE = /^\/informe\/([^/]+)\/plan(?:\/|$)/;

/** "/ Plan" junto al logo cuando estás en el plan o en una de sus tareas (enlace para volver al plan). */
export function HeaderContext() {
  const match = usePathname().match(PLAN_ROUTE);
  if (!match) return null;
  return (
    <>
      <span aria-hidden="true" className="text-muted-foreground">
        /
      </span>
      <Link href={`/informe/${match[1]}/plan`} className="inline-flex min-h-11 items-center font-medium text-muted-foreground hover:text-foreground">
        Plan
      </Link>
    </>
  );
}