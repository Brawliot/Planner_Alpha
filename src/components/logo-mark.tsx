/** Símbolo de Mando: cuadrado lima con rombo oscuro. Decorativo (el nombre va siempre en texto). */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="6" className="fill-accent" />
      <path d="M12 6l6 6-6 6-6-6z" className="fill-accent-foreground" />
    </svg>
  );
}