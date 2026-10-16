import type { ComponentProps } from "react";

type FieldProps = ComponentProps<"input"> & { label: string };

export function Field({ label, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        className={[
          "rounded-md border border-input bg-background px-3 py-2 text-base font-normal",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    </label>
  );
}