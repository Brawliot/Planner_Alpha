/**
 * Cálculo de umbrales a partir de resultados etiquetados. Lógica pura, sin llamadas a Jev.
 */

/** Una respuesta puntuada (confianza o noul) y si era correcta según la etiqueta. */
export interface Scored {
  score: number;
  correct: boolean;
}

export interface Threshold {
  /** Puntuación mínima a partir de la cual se acepta la respuesta. */
  threshold: number;
  /** Fracción de casos que quedan por encima del umbral (los demás irían a pregunta). */
  coverage: number;
  /** Acierto real de los casos por encima del umbral. */
  precision: number;
  /** Casos por encima del umbral. */
  support: number;
}

/**
 * Umbral más bajo con el que el acierto de lo que queda por encima es >= target.
 * Exige un mínimo de casos para que un par de aciertos sueltos no fijen un umbral.
 * Devuelve null si ningún umbral cumple.
 */
export function minScoreFor(results: readonly Scored[], target: number, minSupport = 10): Threshold | null {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  let best: Threshold | null = null;
  let correct = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].correct) correct++;
    // Con empates, el umbral solo puede caer al final del grupo: todos entran o ninguno.
    const endOfTie = i === sorted.length - 1 || sorted[i + 1].score < sorted[i].score;
    if (!endOfTie) continue;

    const support = i + 1;
    const precision = correct / support;
    if (support >= minSupport && precision >= target) {
      best = { threshold: sorted[i].score, coverage: support / sorted.length, precision, support };
    }
  }
  return best;
}

export interface Band {
  band: string;
  n: number;
  accuracy: number | null;
}

/** Acierto por franjas de puntuación, para ver si a más confianza hay más acierto. */
export function accuracyByBand(
  results: readonly Scored[],
  edges: readonly number[] = [0, 0.5, 0.7, 0.8, 0.9, 0.95],
): Band[] {
  return edges.map((low, index) => {
    const high = edges[index + 1] ?? Infinity;
    const inBand = results.filter((r) => r.score >= low && r.score < high);
    const correct = inBand.filter((r) => r.correct).length;
    return {
      band: Number.isFinite(high) ? `${low.toFixed(2)}–${high.toFixed(2)}` : `≥ ${low.toFixed(2)}`,
      n: inBand.length,
      accuracy: inBand.length ? correct / inBand.length : null,
    };
  });
}

/** Fracción de grupos en los que todas las ejecuciones dieron la misma respuesta válida. */
export function agreement(groups: ReadonlyArray<ReadonlyArray<string | null>>) {
  if (groups.length === 0) return null;
  const stable = groups.filter((runs) => runs.length > 0 && runs[0] !== null && runs.every((r) => r === runs[0]));
  return stable.length / groups.length;
}

export function summarize(values: readonly number[]) {
  if (values.length === 0) return { n: 0, min: null, median: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { n: sorted.length, min: sorted[0], median, max: sorted[sorted.length - 1] };
}