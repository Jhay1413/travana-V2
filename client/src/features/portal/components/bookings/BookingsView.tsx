import { useLocation } from "wouter";
import type { PortalBookingListItem } from "@shared/portal-bookings";
import { usePortalBookingList } from "../../api/use-portal-bookings";
import { splitBookings, tripStatusLine } from "../../lib/booking-format";
import { agentFirstName, factsLine, formatMoney, formatRange, paxLabel, toRoman } from "../../lib/quote-format";
import { splitTitle } from "../../lib/quote-title";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { Eyebrow, PortalButton, PortalHero, PortalSection, SplitHeading } from "../brand";

const messageLabel = (agent: string) => (agent === "your agent" ? "Message your agent" : `Message ${agent}`);
const placeOf = (b: PortalBookingListItem) => (b.destination && b.destination !== "TBC" ? b.destination : "");
const endOf = (b: PortalBookingListItem) => b.return_date ?? null;
const startOf = (b: PortalBookingListItem) => (b.travel_date instanceof Date ? b.travel_date.toISOString() : String(b.travel_date)).slice(0, 10);

/** Trips → Bookings: a modest hero, upcoming holidays as photo-led entries, then "Where you've been" as a hairline list. */
export function BookingsView() {
  const { data, isLoading, isError, refetch } = usePortalBookingList();
  const branding = usePortalBrandingValue();
  const agent = agentFirstName(branding.agentName);
  const { upcoming, past } = splitBookings(data ?? []);
  const heroPhoto = upcoming.find((b) => b.image_url)?.image_url;

  return (
    <div data-testid="portal-bookings">
      <PortalHero className="min-h-[230px]" photoUrl={heroPhoto}>
        <Eyebrow className="portal-text-amber-soft">My bookings</Eyebrow>
        <h1 className="portal-serif text-[44px] font-light leading-[1.05] text-white">
          Booked and
          <br />
          <em className="italic">looking forward.</em>
        </h1>
        {!isLoading && !isError && upcoming.length > 0 && (
          <p className="max-w-[300px] text-[15px] leading-[1.6] text-white/85" data-testid="bookings-count">
            {upcoming.length} {upcoming.length === 1 ? "holiday" : "holidays"} coming up.
          </p>
        )}
      </PortalHero>

      <PortalSection className="pb-14 pt-6">
        {isLoading ? (
          <BookingsLoading />
        ) : isError ? (
          <div role="alert" className="py-10 text-center" data-testid="bookings-error">
            <p className="portal-serif text-[26px] text-primary">We couldn&apos;t load your bookings.</p>
            <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
            <PortalButton variant="outline" className="mt-5" onClick={() => void refetch()} data-testid="button-bookings-retry">
              Try again
            </PortalButton>
          </div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <BookingsEmpty agent={agent} />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <div className="grid gap-x-8 md:grid-cols-2" data-testid="bookings-list">
                {upcoming.map((b, i) => (
                  <BookingCard key={b.id} booking={b} index={i} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[15px] text-muted-foreground" data-testid="bookings-none-upcoming">
                No holidays coming up.
              </p>
            )}
            {past.length > 0 && <PastHolidays bookings={past} />}
          </>
        )}
      </PortalSection>
    </div>
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
      <p className="mx-auto mt-3 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground">
        Once a holiday is confirmed it appears here. Have a look at your quotes, or ask {agent} to start planning.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <PortalButton onClick={() => setLocation("/portal/trips/quotes")} data-testid="button-bookings-quotes">
          See my quotes
        </PortalButton>
        <PortalButton variant="link" onClick={() => setLocation("/portal/messages")} data-testid="button-bookings-message">
          {messageLabel(agent)}
        </PortalButton>
      </div>
    </div>
  );
}

function BookingCard({ booking: b, index }: { booking: PortalBookingListItem; index: number }) {
  const [, setLocation] = useLocation();
  const { lead, italic } = splitTitle(b.title);
  const dates = formatRange(startOf(b), endOf(b));
  const pax = paxLabel(b.adults, b.children, b.infants);
  const place = placeOf(b);
  const status = tripStatusLine(b.trip_status, b.days_to_go);
  const title = [lead, italic].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      onClick={() => setLocation(`/portal/booking/${b.id}`)}
      aria-label={`View booking: ${title}, ${dates}`}
      className="group flex w-full min-w-0 flex-col gap-3.5 border-b border-border pb-9 pt-8 text-left"
      data-testid={`booking-card-${b.id}`}
    >
      <span className="flex w-full items-baseline justify-between">
        <span className="portal-serif text-[22px] portal-text-amber-ink" aria-hidden>
          {toRoman(index + 1)}
        </span>
        <span className="portal-caps-label portal-text-amber-ink" data-testid={`booking-status-${b.id}`}>
          {status}
        </span>
      </span>
      <span className="relative block h-[240px] w-full overflow-hidden bg-[hsl(var(--portal-navy-deep))]">
        {b.image_url && <img src={b.image_url} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-105" />}
      </span>
      {(place || b.operator_name) && (
        <span className="flex w-full justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="min-w-0 truncate">{place}</span>
          {b.operator_name && <span className="min-w-0 truncate">{b.operator_name}</span>}
        </span>
      )}
      <span className="portal-serif max-w-full break-words text-[30px] leading-[1.12] text-primary [overflow-wrap:anywhere]" data-testid={`booking-title-${b.id}`}>
        {lead}
        {italic && (
          <>
            {" "}
            <em className="italic">{italic}</em>
          </>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        {dates && <span className="text-[15px] portal-text-ink">{dates}</span>}
        <span className="text-[15px] text-muted-foreground">{factsLine(b.nights, b.board, pax)}</span>
      </span>
      <span className="flex w-full items-end justify-between gap-3 pt-1">
        <span className="flex min-w-0 flex-col gap-1">
          {b.price > 0 && (
            <span className="portal-serif text-[34px] leading-none portal-text-ink" data-testid={`booking-price-${b.id}`}>
              {formatMoney(b.price)}
            </span>
          )}
          {b.price_per_person > 0 && <span className="text-[15px] text-muted-foreground">{formatMoney(b.price_per_person)} per person</span>}
          {b.booking_reference && (
            <span className="max-w-full text-[15px] tracking-[0.08em] text-muted-foreground [overflow-wrap:anywhere]" data-testid={`booking-ref-${b.id}`}>
              Ref {b.booking_reference}
            </span>
          )}
        </span>
        <span className="flex-none pb-1 text-xs uppercase tracking-[0.2em] text-primary group-hover:portal-text-amber-ink">View booking →</span>
      </span>
    </button>
  );
}

function PastHolidays({ bookings }: { bookings: PortalBookingListItem[] }) {
  const [, setLocation] = useLocation();
  return (
    <div className="mt-12" data-testid="bookings-past">
      <Eyebrow className="mb-3.5 text-muted-foreground">Past holidays</Eyebrow>
      <SplitHeading as="h2" lead="Where you've" italic="been." className="mb-5 text-[32px]" />
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
                className="flex min-h-11 w-full flex-col gap-1.5 py-5 text-left"
                data-testid={`booking-past-${b.id}`}
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="portal-serif min-w-0 break-words text-[22px] leading-tight text-primary [overflow-wrap:anywhere]">{b.title}</span>
                  {b.price > 0 && <span className="portal-serif flex-none text-[20px] portal-text-ink">{formatMoney(b.price)}</span>}
                </span>
                <span className="text-[15px] leading-relaxed text-muted-foreground">
                  {place}
                  {place && dates && <br />}
                  {dates}
                </span>
                {b.booking_reference && (
                  <span className="max-w-full text-[15px] tracking-[0.08em] text-muted-foreground [overflow-wrap:anywhere]" data-testid={`booking-past-ref-${b.id}`}>
                    Ref {b.booking_reference}
                  </span>
                )}
                <span className="portal-caps-label portal-text-amber-ink">Travelled</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
