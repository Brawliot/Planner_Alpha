"use client";

import { useState, useSyncExternalStore } from "react";
import { DEPARTMENTS, type Department } from "@/lib/plan/line";

// Departamentos abiertos en las vistas del plan (Fases y Cronograma los comparten), recordados en este
// navegador por informe. Sin nada guardado: todos plegados.
const openKey = (reportId: string) => `mando:plan-abiertos:${reportId}`;

function readOpen(reportId: string) {
  try {
    return window.localStorage.getItem(openKey(reportId)) ?? "";
  } catch {
    return "";
  }
}

function writeOpen(reportId: string, value: string) {
  try {
    window.localStorage.setItem(openKey(reportId), value);
  } catch {
    // Almacenamiento bloqueado: se abre y se cierra igual, solo que no se recuerda.
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

const parseOpen = (value: string) =>
  new Set(value.split(",").filter((d): d is Department => (DEPARTMENTS as readonly string[]).includes(d)));

/** [departamentos abiertos, abrir/cerrar uno]. Al cambiar de vista, la nueva lee lo guardado. */
export function useOpenDepartments(reportId: string) {
  const stored = useSyncExternalStore(subscribe, () => readOpen(reportId), () => "");
  const [override, setOverride] = useState<string | null>(null);
  const expanded = parseOpen(override ?? stored);
  const toggle = (department: Department) => {
    const next = new Set(expanded);
    if (next.has(department)) next.delete(department);
    else next.add(department);
    const value = [...next].join(",");
    setOverride(value);
    writeOpen(reportId, value);
  };
  return [expanded, toggle] as const;
}