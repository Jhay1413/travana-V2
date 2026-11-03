import { useMemo } from "react";
import { formatUKDate, type QuoteDisplay } from "@/features/quote/components/quote-types";
import { buildTripExtras, buildTripStops } from "@/features/client/lib/trip-timeline";
import { TripStop } from "@/features/client/components/holiday/trip-stop";
import { HOLIDAY_BTN_GHOST } from "@/features/client/components/holiday/holiday-styles";

export interface TripBodyProps {
  display: QuoteDisplay;
  /** Opens the edit drawer. When omitted (read-only) the empty state has no Edit button. */
  onEdit?: () => void;
}

/** Body of the "The Trip" tab: start-to-finish line, then the itinerary as a vertical timeline and any add-ons. */
export function TripBody({ display, onEdit }: TripBodyProps) {
  const stops = useMemo(() => buildTripStops(display), [display]);
  const extras = useMemo(() => buildTripExtras(display), [display]);
  const all = [...stops, ...extras];

  const subtitle = [
    "Start to finish",
    display.travelDate && display.returnDate ? `${formatUKDate(display.travelDate)} to ${formatUKDate(display.returnDate)}` : "",
    display.nights > 0 ? `${display.nights} nights` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div data-testid="holiday-trip-card">
      <p className="mb-3.5 text-[13px] text-qp-muted">{subtitle}</p>
      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-5 text-center text-[13px] text-qp-muted" data-testid="trip-empty">
          <p>No itinerary lines yet.</p>
          {onEdit && (
            <button type="button" className={HOLIDAY_BTN_GHOST} onClick={onEdit}>
              Edit
            </button>
          )}
        </div>
      ) : (
        <ol className="flex flex-col">
          {all.map((stop, i) => (
            <TripStop key={stop.id} stop={stop} isLast={i === all.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}
