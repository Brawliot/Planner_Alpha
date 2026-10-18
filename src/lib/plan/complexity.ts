/**
 * Complejidad de una línea para el negocio concreto, clasificada por Jev. Decide cuántas tareas
 * puede sugerir la IA en esa línea. Si Jev no está seguro (null), se trata como baja: no se añade
 * trabajo sin base.
 */

export const COMPLEXITIES = ["low", "medium", "high"] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

/** Ajustable tras probar con ideas reales. */
export const MAX_SUGGESTIONS: Record<Complexity, number> = { low: 1, medium: 2, high: 4 };

export function maxSuggestions(complexity: Complexity | null) {
  return MAX_SUGGESTIONS[complexity ?? "low"];
}