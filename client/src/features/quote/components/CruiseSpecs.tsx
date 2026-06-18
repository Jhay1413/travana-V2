import { formatUKDate } from "@/features/quote/components/quote-types";
import { SpecRow } from "@/components/ui/spec-row";

interface CruiseSpecsProps {
  cruise?: {
    cruiseLine: string;
    ship: string;
    cabinType: string;
    cabinNumber: string;
    embarkation: string;
    debarkation: string;
    cruiseName: string;
    cruiseDate: string;
    preCruiseStay: number;
    postCruiseStay: number;
    itinerary: { day: number; description: string; subDescription?: string }[];
  };
  nights: number | string;
  passengers: { adults: number; children: number };
}

// Read-only cruise detail view shared by the quote and booking detail pages.
// Mirrors the "view" side of the cruise quote preview.
export function CruiseSpecs({ cruise, nights, passengers }: CruiseSpecsProps) {
  const itinerary = cruise?.itinerary ?? [];

  return (
    <>
      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
          <SpecRow testId="cruise-line" label="Cruise Company" value={cruise?.cruiseLine || "—"} />
          <SpecRow testId="ship" label="Ship" value={cruise?.ship || "—"} />
          <SpecRow testId="embarkation" label="Leaving From" value={cruise?.embarkation || "—"} />
          <SpecRow
            testId="cruise-date"
            label="Departure Date"
            value={cruise?.cruiseDate ? formatUKDate(cruise.cruiseDate) : "—"}
          />
        </div>
        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
          <SpecRow testId="nights" label="Number of Nights" value={nights} />
          <SpecRow testId="guests" label="Number of Guests" value={passengers.adults + passengers.children} />
          <SpecRow testId="cabin-type" label="Cabin Type" value={cruise?.cabinType || "—"} />
          <SpecRow testId="cabin-number" label="Location / Cabin" value={cruise?.cabinNumber || "—"} />
        </div>
      </div>

      {itinerary.length > 0 && (
        <div className="mt-3" data-testid="list-itinerary-view">
          <div className="mb-2 text-xs font-semibold text-black/65">Itinerary</div>
          <div className="grid gap-2">
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
      )}
    </>
  );
}
