"use client";

import { useState } from "react";
import type { PlanTexts } from "@/lib/plan/i18n";
import type { PlanView } from "@/lib/plan/view";
import { cn } from "@/lib/cn";
import { AreasMap } from "./areas-map";
import { MetroMap, type MetroTask } from "./metro-map";
import { PlanInspector, type InspectorTab } from "./plan-inspector";
import { TimelineChart } from "./timeline-chart";

type MapView = "phases" | "areas" | "timeline";

/**
 * El mapa (Fases · Áreas · Cronograma) y el inspector, conectados: lo que se pulsa en el mapa
 * se abre en la pestaña "Tarea"; al pasar el ratón, esa pestaña muestra la tarea señalada.
 */
export function PlanWorkspace({
  view,
  tasks,
  today,
  t,
  reportId,
  version,
}: {
  view: PlanView;
  tasks: MetroTask[];
  today: string;
  t: PlanTexts;
  reportId: string;
  version: number;
}) {
  const [mapView, setMapView] = useState<MapView>("phases");
  const [tab, setTab] = useState<InspectorTab>("now");
  const [selected, setSelected] = useState<string | null>(view.now[0]?.taskId ?? null);
  const [hovered, setHovered] = useState<string | null>(null);
  const select = (id: string) => {
    setSelected(id);
    setTab("task");
  };
  const mapProps = { view, tasks, t, hovered, onHover: setHovered, onSelect: select };

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
    <div className="grid gap-4 lg:h-[calc(100vh-10rem)] lg:min-h-[560px] lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="hud map-canvas flex min-h-0 flex-col gap-3 rounded-[1.5rem] border bg-surface/60 p-4">
        <nav aria-label={t.overview.viewsLabel} className="flex flex-wrap gap-1 self-start rounded-full bg-surface p-1 text-sm font-semibold">
          {viewTab("phases", t.overview.views.phases)}
          {viewTab("areas", t.overview.views.areas)}
          {viewTab("timeline", t.overview.views.timeline)}
        </nav>
        <div className="min-h-0 flex-1 overflow-auto">
          {mapView === "phases" && <MetroMap {...mapProps} reportId={reportId} />}
          {mapView === "areas" && <AreasMap {...mapProps} />}
          {mapView === "timeline" && <TimelineChart {...mapProps} reportId={reportId} today={today} />}
        </div>
      </section>

      <PlanInspector
        tab={tab}
        onTab={setTab}
        view={view}
        tasks={tasks}
        activeId={hovered ?? selected}
        t={t}
        reportId={reportId}
        version={version}
      />
    </div>
  );
}