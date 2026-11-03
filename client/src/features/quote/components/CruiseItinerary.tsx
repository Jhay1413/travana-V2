interface CruiseItineraryDay {
  day: number;
  description: string;
  subDescription?: string;
}

interface CruiseItineraryProps {
  itinerary: CruiseItineraryDay[];
}

// Day-by-day cruise itinerary list — shared by CruiseSpecs (standalone quote /
// booking detail pages) and the holiday detail view (the client-page "quote
// selection" surface) so both render the exact same look. Scrolls instead of
// growing unbounded for long (14+ day) itineraries.
export function CruiseItinerary({ itinerary }: CruiseItineraryProps) {
  if (itinerary.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-3" data-testid="card-itinerary-view">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold" data-testid="text-itinerary-title">
          Itinerary
        </div>
        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-black/50" data-testid="text-itinerary-count">
          {itinerary.length} {itinerary.length === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto pr-1" data-testid="list-itinerary-view">
        {itinerary.map((d, i) => (
          <div
            key={i}
            className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
            data-testid={`row-itinerary-view-${i}`}
          >
            <div className="shrink-0 text-xs font-semibold text-black/65" data-testid={`text-itinerary-day-${i}`}>
              Day {d.day || i + 1}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-end">
              <div
                className="min-w-0 max-w-full truncate text-right text-xs font-semibold text-black"
                data-testid={`text-itinerary-port-${i}`}
              >
                {d.description || "—"}
              </div>
              {d.subDescription ? (
                <div
                  className="min-w-0 max-w-full truncate text-right text-xs font-normal text-black/55"
                  data-testid={`text-itinerary-subdescription-${i}`}
                >
                  {d.subDescription}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
