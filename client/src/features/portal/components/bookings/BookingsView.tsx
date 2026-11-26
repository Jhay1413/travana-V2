import { useLocation } from "wouter";
import type { PortalBookingListItem } from "@shared/portal-bookings";
import { usePortalBookingList } from "../../api/use-portal-bookings";
import { splitBookings, tripStatusLine } from "../../lib/booking-format";
import { agentFirstName, formatMoney, formatRange } from "../../lib/quote-format";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { Eyebrow, PortalButton, PortalHero, PortalSection, SplitHeading } from "../brand";
import { BookingDetailView } from "./BookingDetailView";

const messageLabel = (agent: string) => (agent === "your agent" ? "Message your agent" : `Message ${agent}`);
const placeOf = (b: PortalBookingListItem) => (b.destination && b.destination !== "TBC" ? b.destination : "");
const endOf = (b: PortalBookingListItem) => b.return_date ?? null;
const startOf = (b: PortalBookingListItem) => (b.travel_date instanceof Date ? b.travel_date.toISOString() : String(b.travel_date)).slice(0, 10);

/**
 * "My bookings", as the design: the customer's next holiday in full (hero, facts, flights ...), then "Your other
 * holidays" (any further upcoming ones, as a compact list) and "Past holidays / Where you've been." at the end.
 */
export function BookingsView() {
  const { data, isLoading, isError, refetch } = usePortalBookingList();
  const branding = usePortalBrandingValue();
  const agent = agentFirstName(branding.agentName);
  const { upcoming, past } = splitBookings(data ?? []);
  const [next, ...others] = upcoming;

  const lists = (
    <>
      {others.length > 0 && <OtherHolidays bookings={others} />}
      {past.length > 0 && <PastHolidays bookings={past} />}
    </>
  );

  if (isLoading) {
    return (
      <div data-testid="portal-bookings">
        <BookingsHero />
        <PortalSection className="px-6 pb-[88px] pt-10">
          <BookingsLoading />
        </PortalSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="portal-bookings">
        <BookingsHero />
        <PortalSection className="px-6 pb-[88px] pt-10">
          <div role="alert" className="py-10 text-center" data-testid="bookings-error">
            <p className="portal-serif text-[26px] text-primary">We couldn&apos;t load your bookings.</p>
            <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
            <PortalButton variant="outline" className="mt-5" onClick={() => void refetch()} data-testid="button-bookings-retry">
              Try again
            </PortalButton>
          </div>
        </PortalSection>
      </div>
    );
  }

  if (!next) {
    const none = past.length === 0;
    return (
      <div data-testid="portal-bookings">
        <BookingsHero line={none ? undefined : "No holidays coming up."} lineTestId="bookings-none-upcoming" />
        {none ? (
          <PortalSection className="px-6 pb-[88px] pt-10">
            <BookingsEmpty agent={agent} />
          </PortalSection>
        ) : (
          lists
        )}
      </div>
    );
  }

  return (
    <div data-testid="portal-bookings">
      <BookingDetailView id={next.id}>{lists}</BookingDetailView>
    </div>
  );
}

/** The hero for the states with no holiday to show in full (loading, error, none coming up). */
function BookingsHero({ line, lineTestId }: { line?: string; lineTestId?: string }) {
  return (
    <PortalHero className="h-[480px] md:h-[480px]">
      <Eyebrow className="text-accent">My bookings</Eyebrow>
      <h1 className="portal-serif text-[48px] font-light leading-none tracking-[-0.01em] text-white">
        Booked and
        <br />
        <em className="italic">looking forward.</em>
      </h1>
      {line && (
        <p className="max-w-[290px] text-[15px] leading-[1.7] text-white/[0.78]" data-testid={lineTestId}>
          {line}
        </p>
      )}
    </PortalHero>
  );
}

function BookingsLoading() {
  return (
    <div className="flex flex-col gap-10" role="status" aria-label="Loading your bookings" data-testid="bookings-loading">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse border-b border-border pb-9">
          <div className="h-[220px] bg-secondary" />
          <div className="mt-4 h-4 w-1/3 bg-secondary" />
          <div className="mt-3 h-8 w-3/4 bg-secondary" />
          <div className="mt-3 h-4 w-1/2 bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function BookingsEmpty({ agent }: { agent: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="py-10 text-center" data-testid="bookings-empty">
      <SplitHeading as="h2" lead="No holidays" italic="booked yet." className="text-[40px] leading-[1.08]" />
      <p className="mx-auto mt-3 max-w-[320px] text-[15px] leading-[1.7] text-muted-foreground">
        Once a holiday is confirmed it appears here. Have a look at your quotes, or ask {agent} to start planning.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <PortalButton onClick={() => setLocation("/portal/quotes")} data-testid="button-bookings-quotes">
          See my quotes
        </PortalButton>
        <PortalButton variant="link" onClick={() => setLocation("/portal/messages")} data-testid="button-bookings-message">
          {messageLabel(agent)}
        </PortalButton>
      </div>
    </div>
  );
}

/** Further upcoming holidays: a compact hairline list in the past-holidays row style, each opening its own full screen. */
function OtherHolidays({ bookings }: { bookings: PortalBookingListItem[] }) {
  const [, setLocation] = useLocation();
  return (
    <PortalSection aria-labelledby="bookings-others" className="pb-6 pt-16" data-testid="bookings-others">
      <Eyebrow className="mb-3.5">More to come</Eyebrow>
      <SplitHeading id="bookings-others" lead="Your other" italic="holidays." className="mb-[22px] text-[32px]" />
      <ul className="border-b border-border">
        {bookings.map((b) => {
          const dates = formatRange(startOf(b), endOf(b));
          const place = placeOf(b);
          return (
            <li key={b.id} className="border-t border-border">
              <button
                type="button"
                onClick={() => setLocation(`/portal/booking/${b.id}`)}
                aria-label={`View booking: ${b.title}, ${dates}`}
                className="flex min-h-11 w-full flex-col gap-1.5 py-[22px] text-left"
                data-testid={`booking-other-${b.id}`}
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="portal-serif min-w-0 break-words text-2xl text-primary [overflow-wrap:anywhere]">{b.title}</span>
                  {b.price > 0 && <span className="portal-serif flex-none text-[22px] portal-text-ink">{formatMoney(b.price)}</span>}
                </span>
                <span className="text-sm leading-[1.6] text-muted-foreground">
                  {place}
                  {place && dates && <br />}
                  {dates}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.24em] portal-text-amber-ink" data-testid={`booking-status-${b.id}`}>
                  {tripStatusLine(b.trip_status, b.days_to_go)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </PortalSection>
  );
}

function PastHolidays({ bookings }: { bookings: PortalBookingListItem[] }) {
  const [, setLocation] = useLocation();
  return (
    <PortalSection aria-labelledby="bookings-past" className="pb-[88px] pt-16" data-testid="bookings-past">
      <Eyebrow className="mb-3.5">Past holidays</Eyebrow>
      <SplitHeading id="bookings-past" lead="Where you've" italic="been." className="mb-[22px] text-[32px]" />
      <ul className="border-b border-border">
        {bookings.map((b) => {
          const dates = formatRange(startOf(b), endOf(b));
          const place = placeOf(b);
          return (
            <li key={b.id} className="border-t border-border">
              <button
                type="button"
                onClick={() => setLocation(`/portal/booking/${b.id}`)}
                aria-label={`View booking: ${b.title}, ${dates}`}
                className="flex min-h-11 w-full flex-col gap-1.5 py-[22px] text-left"
                data-testid={`booking-past-${b.id}`}
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="portal-serif min-w-0 break-words text-2xl text-primary [overflow-wrap:anywhere]">{b.title}</span>
                  {b.price > 0 && <span className="portal-serif flex-none text-[22px] portal-text-ink">{formatMoney(b.price)}</span>}
                </span>
                <span className="text-sm leading-[1.6] text-muted-foreground">
                  {place}
                  {place && dates && <br />}
                  {dates}
                </span>
                {b.booking_reference && (
                  <span className="max-w-full text-[15px] tracking-[0.08em] text-muted-foreground [overflow-wrap:anywhere]" data-testid={`booking-past-ref-${b.id}`}>
                    Ref {b.booking_reference}
                  </span>
                )}
                <span className="mt-1 text-[10px] uppercase tracking-[0.24em] portal-text-amber-ink">Travelled</span>
              </button>
            </li>
          );
        })}
      </ul>
    </PortalSection>
  );
}
