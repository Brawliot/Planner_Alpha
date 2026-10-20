/** Iniciales del avatar: primera letra del nombre y de los apellidos ("Ana", "Pérez García" → "AP"). */
export function initials(name: string, lastName?: string | null): string {
  // Array.from: no parte letras compuestas (emojis, algunos acentos) por la mitad.
  const first = (value: string | null | undefined) => Array.from(value?.trim() ?? "")[0] ?? "";
  return (first(name) + first(lastName)).toLocaleUpperCase("es-ES") || "?";
}