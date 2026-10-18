import { createHash } from "node:crypto";
import { usable } from "../report/areas.ts";
import type { Fact } from "../report/facts.ts";
import type { Language, StoredNarrative } from "../report/narrative.ts";
import { areaVerdicts, type AreaVerdict } from "../report/verdict.ts";

/**
 * S1: lo que el plan recibe del informe. El plan no copia el informe: lo lee en directo y
 * calcula los veredictos con el mismo código. Solo guarda la huella para saber si está desactualizado.
 * Solo servidor (node:crypto). La propiedad y el estado "approved" los comprueba la acción.
 */

export interface PlanInput {
  reportId: string;
  idea: string;
  language: Language;
  facts: readonly Fact[];
  verdicts: AreaVerdict[];
  /** Cambia solo si cambia algo que afecta al plan. */
  fingerprint: string;
}

/** Datos utilizables (valor y certeza) y veredictos, ordenados: sin confianzas, modelos ni orden. */
export function planFingerprint(facts: readonly Fact[], verdicts: readonly AreaVerdict[]) {
  const keys = [...new Set(facts.map((fact) => fact.key))].sort();
  const data = keys.flatMap((key) => {
    const input = usable(facts, key);
    return input ? [[key, input.value, input.certainty]] : [];
  });
  const colors = [...verdicts]
    .sort((a, b) => a.area.localeCompare(b.area))
    .map((v) => [v.area, v.verdict, v.reason, [...v.missing].sort(), [...v.gaps].sort(), v.estimated]);
  return createHash("sha256").update(JSON.stringify([data, colors])).digest("hex");
}

export function planInput(report: {
  id: string;
  idea: string;
  facts: readonly Fact[];
  narrative: StoredNarrative | null;
}): PlanInput {
  const verdicts = areaVerdicts(report.facts);
  return {
    reportId: report.id,
    idea: report.idea,
    language: report.narrative?.language === "es" ? "es" : "en",
    facts: report.facts,
    verdicts,
    fingerprint: planFingerprint(report.facts, verdicts),
  };
}