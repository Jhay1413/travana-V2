import { forwardRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBarColor } from "../destination-guru";
import type { GuruDestinationItem } from "../../types";

interface GlobeHoverCardProps {
  item: GuruDestinationItem | null;
  isTouch: boolean;
  onViewDetails: (key: string) => void;
}

// Plain DOM overlay (not drei <Html>) — positioned imperatively every frame
// by globe-scene.tsx / destination-pins.tsx writing straight to this
// component's ref, so hovering doesn't trigger a React re-render per frame.
export const GlobeHoverCard = forwardRef<HTMLDivElement, GlobeHoverCardProps>(function GlobeHoverCard(
  { item, isTouch, onViewDetails },
  ref,
) {
  const maxTemp = item ? Math.max(...item.data.temperatures.map((t) => t.avgHigh)) : 0;

  return (
    <Card
      ref={ref}
      data-testid="guru-hover-card"
      className={cn(
        "absolute left-0 top-0 z-10 w-64 overflow-hidden border-black/10 bg-white/95 p-3 opacity-0 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/95",
        isTouch ? "pointer-events-auto" : "pointer-events-none",
      )}
      style={{ willChange: "transform, opacity" }}
    >
      {item && (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg leading-none">{item.data.heroEmoji}</span>
                <h4 className="truncate text-sm font-semibold">{item.destination}</h4>
              </div>
              <p className="truncate text-xs text-black/50 dark:text-white/50">{item.country}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-orange-600">↑ {maxTemp}°C</span>
          </div>

          <p className="mt-1.5 text-[11px] text-black/60 dark:text-white/60">
            {item.data.bestTimeToVisit.months}
          </p>

          <div className="mt-2 flex gap-0.5">
            {item.data.temperatures.map((t, i) => (
              <div
                key={i}
                className="h-3 flex-1 rounded-sm"
                style={{ backgroundColor: getBarColor(t.avgHigh), opacity: 0.75 }}
              />
            ))}
          </div>

          {isTouch && (
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => onViewDetails(item.key)}
              data-testid="button-guru-hover-view-details"
            >
              View details
            </Button>
          )}
        </>
      )}
    </Card>
  );
});
