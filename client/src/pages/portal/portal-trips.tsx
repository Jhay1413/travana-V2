import { useLocation } from "wouter";
import { BookingsView, QuotesView, TRIPS_SEGMENTS, tripsSegmentForPath } from "@/features/portal";
import { cn } from "@/lib/utils";
import PortalLayout from "./portal-layout";

/** Trips: Quotes and Bookings as two segments of one tab, both in the new look. */
export default function PortalTripsPage() {
  const [location, setLocation] = useLocation();
  const segment = tripsSegmentForPath(location);

  return (
    <PortalLayout tone="light">
      <nav aria-label="Trips" className="mx-auto flex max-w-lg gap-8 px-5 pt-2" data-testid="trips-segments">
        {TRIPS_SEGMENTS.map((s) => {
          const on = s.key === segment;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setLocation(s.path)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "min-h-11 border-b-2 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors",
                on ? "border-accent text-primary" : "border-transparent text-muted-foreground hover:text-primary",
              )}
              data-testid={`trips-segment-${s.key}`}
            >
              {s.label}
            </button>
          );
        })}
      </nav>
      {segment === "bookings" ? <BookingsView /> : <QuotesView />}
    </PortalLayout>
  );
}
