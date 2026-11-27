import type { JourneyItem } from "../../lib/quote-journey";
import { Eyebrow, PortalSection, SplitHeading } from "../brand";

/** The flights of a journey (any outbound, return or other leg), in order. */
export function flightItems(items: JourneyItem[]): JourneyItem[] {
  return items.filter((i) => i.flight && (i.kind === "flight-out" || i.kind === "flight-in" || i.kind === "flight"));
}

/** Everything in the journey that is not a flight (transfers, hotels, cruises, car hire, tickets, lounges, parking, extras). */
export function otherItems(items: JourneyItem[]): JourneyItem[] {
  return items.filter((i) => !flightItems(items).includes(i));
}

/** The design's "Flights / There and back." section: one hairline card per leg. Nothing when the booking has no flights. */
export function BookingFlights({ items }: { items: JourneyItem[] }) {
  const flights = flightItems(items);
  if (flights.length === 0) return null;
  return (
    <PortalSection aria-labelledby="booking-flights" className="pb-6 pt-16" data-testid="booking-flights">
      <Eyebrow className="mb-3.5">Flights</Eyebrow>
      <SplitHeading id="booking-flights" lead="There" italic="and back." className="mb-[26px]" />
      <div className="border-b border-border">
        {flights.map((f) => {
          const [date = "", number = ""] = (f.detail[0] ?? "").split(" · ");
          const rest = [number, ...f.detail.slice(1)].filter(Boolean);
          return (
            <div key={f.key} className="flex flex-col gap-4 border-t border-border py-[26px]" data-testid={`booking-flight-${f.key}`}>
              <div className="flex justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <span className="portal-text-amber-ink">{f.kicker}</span>
                <span>{date}</span>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="portal-serif text-4xl leading-none portal-text-ink">{f.flight?.dep || "–"}</span>
                  <span className="portal-serif [overflow-wrap:anywhere] text-[19px] leading-[1.2] text-primary">{f.flight?.from}</span>
                </div>
                <span aria-hidden className="mt-[18px] h-px w-7 flex-none bg-accent" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-right">
                  <span className="portal-serif text-4xl leading-none portal-text-ink" aria-label={`arrives ${f.flight?.arr ?? ""}${f.flight?.nextDay ? " the next day" : ""}`}>
                    {f.flight?.arr || "–"}
                    {f.flight?.nextDay ? " +1" : ""}
                  </span>
                  <span className="portal-serif [overflow-wrap:anywhere] text-[19px] leading-[1.2] text-primary">{f.flight?.to}</span>
                </div>
              </div>
              {rest.length > 0 && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{rest.join(" · ")}</p>}
            </div>
          );
        })}
      </div>
    </PortalSection>
  );
}
