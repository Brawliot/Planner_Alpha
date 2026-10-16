import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-3xl",
  lg: "max-w-6xl",
} as const;

type PageContainerProps = ComponentProps<"main"> & {
  size?: keyof typeof sizes;
  /** Centra el contenido verticalmente (páginas cortas: login, errores). */
  centered?: boolean;
};

export function PageContainer({ size = "md", centered = false, className, ...props }: PageContainerProps) {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-4 p-6 outline-none",
        sizes[size],
        centered && "justify-center",
        className,
      )}
      {...props}
    />
  );
}