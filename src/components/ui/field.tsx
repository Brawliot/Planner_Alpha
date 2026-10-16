import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type FieldProps = ComponentProps<"input"> & { label: string };

export function Field({ label, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        className={cn(
          "rounded-md border border-input bg-background px-3 py-2 text-base font-normal",
          className,
        )}
        {...props}
      />
    </label>
  );
}