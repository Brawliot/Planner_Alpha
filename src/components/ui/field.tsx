import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Estilo común de los campos de texto: 44 px y halo lima al enfocar (como la caja de la portada). */
export const inputStyles =
  "min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base font-normal transition-shadow focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25 focus-visible:outline-none";

type FieldProps = ComponentProps<"input"> & { label: string };

export function Field({ label, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input className={cn(inputStyles, className)} {...props} />
    </label>
  );
}