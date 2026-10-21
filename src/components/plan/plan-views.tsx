"use client";

import { useState, type ReactNode } from "react";
import type { PlanTexts } from "@/lib/plan/i18n";
import { cn } from "@/lib/cn";

type View = "phases" | "timeline";

/** Selector de vistas del plan: cambia sin recargar. Las vistas llegan ya pintadas desde el servidor. */
export function PlanViews({ t, phases, timeline }: { t: PlanTexts; phases: ReactNode; timeline: ReactNode }) {
  const [view, setView] = useState<View>("phases");
  const tab = (id: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === id}
      onClick={() => setView(id)}
      className={cn(
        "min-h-11 rounded-full px-4 py-2",
        view === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t.overview.viewsLabel} className="flex flex-wrap gap-1 self-start rounded-full bg-surface p-1 text-sm font-semibold">
        {tab("phases", t.overview.views.phases)}
        <span aria-disabled="true" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-muted-foreground">
          {t.overview.views.areas}
          <span className="rounded-full bg-muted px-2 text-[10px] font-medium">{t.overview.soon}</span>
        </span>
        {tab("timeline", t.overview.views.timeline)}
      </nav>

      <section className="hud map-canvas rounded-[1.5rem] border bg-surface/60 p-4">{view === "phases" ? phases : timeline}</section>
    </div>
  );
}