import type { Verdict } from "@/lib/report/verdict";
import { cn } from "@/lib/cn";

const STYLES: Record<Verdict, { symbol: string; className: string }> = {
  strong: { symbol: "✓", className: "border-success text-success" },
   risk: { symbol: "✕", className: "border-danger text-danger" },
  doubt: { symbol: "!", className: "border-warning text-warning" },
  needs_info: { symbol: "?", className: "border-muted-foreground text-muted-foreground" },
};

/** Icono de veredicto. Decorativo: el veredicto siempre va también en texto (VerdictLabel). */
export function VerdictIcon({ verdict, className }: { verdict: Verdict; className?: string }) {
  const style = STYLES[verdict];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-bold",
        style.className,
        className,
      )}
    >
      {style.symbol}
    </span>
  );
}

const LABEL_COLOR: Record<Verdict, string> = {
  strong: "text-success",
    risk: "text-danger",
  doubt: "text-warning",
  needs_info: "text-muted-foreground",
};

/** Etiqueta de texto del veredicto, en el color de su token. */
export function VerdictLabel({ verdict, children }: { verdict: Verdict; children: React.ReactNode }) {
  return (
    <span className={cn("text-[11px] font-semibold uppercase tracking-[0.08em]", LABEL_COLOR[verdict])}>
      {children}
    </span>
  );
}