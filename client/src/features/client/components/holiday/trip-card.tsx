import { useMemo } from "react";
import { formatUKDate, type QuoteDisplay } from "@/features/quote/components/quote-types";
import { buildTripExtras, buildTripStops } from "@/features/client/lib/trip-timeline";
import { TripStop } from "@/features/client/components/holiday/trip-stop";
import { HOLIDAY_BTN_GHOST, HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

export interface TripCardProps {
  display: QuoteDisplay;
  /** Opens the edit drawer. When omitted (read-only) the empty state has no Edit button. */
  onEdit?: () => void;
}

/** "The trip, start to finish": the itinerary as a vertical timeline, then any add-ons. */
export function TripCard({ display, onEdit }: TripCardProps) {
  const stops = useMemo(() => buildTripStops(display), [display]);
  const extras = useMemo(() => buildTripExtras(display), [display]);
  const all = [...stops, ...extras];

  const subtitle = [
    display.travelDate && display.returnDate ? `${formatUKDate(display.travelDate)} to ${formatUKDate(display.returnDate)}` : "",
    display.nights > 0 ? `${display.nights} nights` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={HOLIDAY_CARD} aria-labelledby="holiday-trip-h" data-testid="holiday-trip-card">
      <div className="mb-3.5">
        <h2 id="holiday-trip-h" className="text-base font-semibold leading-snug">
          The trip, start to finish
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-qp-muted">{subtitle}</p>}
      </div>
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
    </section>
  );
}
