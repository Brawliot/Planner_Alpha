import type { ComponentProps } from "react";

const variants = {
  primary:
    "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90",
  secondary:
    "rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted",
  link: "underline underline-offset-4 hover:opacity-80",
} as const;

export type ButtonVariant = keyof typeof variants;

/** Clases de botón, también para <Link> o <a> con aspecto de botón. */
export function buttonStyles(variant: ButtonVariant = "primary", className?: string) {
  return [
    "inline-flex items-center justify-center transition-opacity disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles(variant, className)} {...props} />;
}