"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { PlanView } from "@/lib/plan/view";
import { cn } from "@/lib/cn";
import { AreasMap } from "./areas-map";
import { MetroMap, type MetroTask } from "./metro-map";
import { PlanInspector, type InspectorTab } from "./plan-inspector";
import { TimelineChart } from "./timeline-chart";

type MapView = "phases" | "areas" | "timeline";

const SHEET_OPEN = 400;
const SHEET_RAIL = 56;

// Panel plegado o abierto, recordado en este navegador. Sin nada guardado: abierto, salvo en pantallas estrechas.
const PANEL_KEY = "mando:plan-panel";
const NARROW = "(max-width: 1023px)";
function readPanel() {
  try {
    const stored = window.localStorage.getItem(PANEL_KEY);
    if (stored === "open" || stored === "closed") return stored;
  } catch {
    // Almacenamiento bloqueado: se decide por el ancho.
  }
  return window.matchMedia(NARROW).matches ? "closed" : "open";
}
function writePanel(value: "open" | "closed") {
  try {
    window.localStorage.setItem(PANEL_KEY, value);
  } catch {
    // No se recuerda, pero se pliega igual.
  }
}
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/**
 * El plan a pantalla completa: el mapa de fondo y, encima, las pestañas de vista, la hoja del
 * inspector pegada al borde derecho (plegable a un riel) y la barra de estado abajo.
 */
export function PlanWorkspace({
  view,
  tasks,
  today,
  t,
  reportId,
  version,
  status,
}: {
  view: PlanView;
  tasks: MetroTask[];
  today: string;
  t: PlanTexts;
  reportId: string;
  version: number;
  /** Barra de estado (apertura, dinero, fecha límite, progreso), pintada en el servidor. */
  status: ReactNode;
}) {
  const [mapView, setMapView] = useState<MapView>("phases");
  const [tab, setTab] = useState<InspectorTab>("now");
  const [selected, setSelected] = useState<string | null>(view.now[0]?.taskId ?? null);
  const [hovered, setHovered] = useState<string | null>(null);

  const storedPanel = useSyncExternalStore(subscribe, readPanel, () => "open" as const);
  const [panelOverride, setPanelOverride] = useState<"open" | "closed" | null>(null);
  const collapsed = (panelOverride ?? storedPanel) === "closed";
  const setPanel = (value: "open" | "closed") => {
    setPanelOverride(value);
    writePanel(value);
  };
  const sheetWidth = collapsed ? SHEET_RAIL : SHEET_OPEN;

  const openTab = (next: InspectorTab) => {
    setTab(next);
    if (collapsed) setPanel("open");
  };
  const select = (id: string) => {
    setSelected(id);
    openTab("task");
  };
  const mapProps = { view, t, hovered, onHover: setHovered, onSelect: select };

  const viewTab = (id: MapView, label: string) => (
    <button
      type="button"
      aria-pressed={mapView === id}
      onClick={() => setMapView(id)}
      className={cn(
        "min-h-11 rounded-full px-4 py-2",
        mapView === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="map-canvas relative h-[calc(100vh-3.5rem)] min-h-[520px] overflow-hidden bg-background">
      {/* Fondo: el mapa, con margen para no quedar debajo de las capas de encima. */}
      <div
        className="absolute inset-0 overflow-auto pt-20 pb-16 pl-6 transition-[padding] duration-200 motion-reduce:transition-none"
        style={{ paddingRight: sheetWidth + 24 }}
      >
        {mapView === "phases" && <MetroMap {...mapProps} tasks={tasks} reportId={reportId} />}
        {mapView === "areas" && <AreasMap {...mapProps} />}
        {mapView === "timeline" && <TimelineChart {...mapProps} reportId={reportId} today={today} />}
      </div>

      <nav
        aria-label={t.overview.viewsLabel}
        className="absolute top-4 left-4 flex flex-wrap gap-1 rounded-full border border-border bg-surface/80 p-1 text-sm font-semibold backdrop-blur-md"
      >
        {viewTab("phases", t.overview.views.phases)}
        {viewTab("areas", t.overview.views.areas)}
        {viewTab("timeline", t.overview.views.timeline)}
      </nav>

      <div
        className="absolute top-0 right-0 bottom-0 transition-[width] duration-200 motion-reduce:transition-none"
        style={{ width: sheetWidth }}
      >
        <PlanInspector
          tab={tab}
          onTab={openTab}
          view={view}
          tasks={tasks}
          activeId={hovered ?? selected}
          t={t}
          reportId={reportId}
          version={version}
          collapsed={collapsed}
          onCollapse={() => setPanel("closed")}
        />
      </div>

      <div
        className="absolute bottom-0 left-0 border-t border-border bg-background/75 px-5 py-3 backdrop-blur-md transition-[right] duration-200 motion-reduce:transition-none"
        style={{ right: sheetWidth }}
      >
        {status}
      </div>
    </div>
  );
}