import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import type { PortalBookingDetail } from "@shared/portal-bookings";
import { env } from "@/config/env";
import { usePortalBooking } from "../../api/use-portal-bookings";
import { heroCountdown, paymentsSectionEnabled } from "../../lib/booking-format";
import { fitHeroSize, HERO_HEADING_WRAP } from "../../lib/home";
import { usePortalMessageSheet } from "../messages/MessageSheet";
import { agentFirstName, formatMoney, formatRange, paxLabel, PRICE_INCLUDES_LINE, factsLine } from "../../lib/quote-format";
import { buildJourney } from "../../lib/quote-journey";
import { splitTitle } from "../../lib/quote-title";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { Eyebrow, FactList, PortalButton, PortalHero, PortalSection, SplitHeading } from "../brand";
import { GALLERY_CLOSED, QuoteGallery, QuotePhotoStrip, type GalleryView } from "../quotes/QuoteGallery";
import { QuoteJourney } from "../quotes/QuoteJourney";
import { BookingFlights, flightItems, otherItems } from "./BookingFlights";
import { BookingPayments } from "./BookingPayments";
import { BookingChecklistSlot, BookingDocumentsSlot, BookingPassportsSlot } from "./BookingSlots";

/** A long reference or title must wrap rather than push the page sideways. */
const WRAP = "max-w-full [overflow-wrap:anywhere]";

function BookingNotFound() {
  const [, setLocation] = useLocation();
  return (
    <PortalSection className="py-20 text-center" data-testid="booking-not-found">
      <Eyebrow>Booking not found</Eyebrow>
      <SplitHeading as="h1" lead="We can't find" italic="that booking." className="mt-3 text-[40px] leading-[1.08]" />
      <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-[1.7] text-muted-foreground">
        The link may be out of date, or the booking isn&apos;t on your account. Your own bookings are all in one place.
      </p>
      <PortalButton className="mt-6" onClick={() => setLocation("/portal/bookings")} data-testid="button-back-to-bookings">
        Back to my bookings
      </PortalButton>
    </PortalSection>
  );
}

function BookingLoading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading your booking" data-testid="booking-loading">
      <div className="h-[320px] bg-secondary" />
      <div className="mx-auto mt-8 max-w-3xl space-y-4 px-7">
        <div className="h-4 w-1/3 bg-secondary" />
        <div className="h-10 w-3/4 bg-secondary" />
        <div className="h-4 w-1/2 bg-secondary" />
      </div>
    </div>
  );
}

/**
 * The design's "My bookings" screen for one holiday: the hero with the countdown, the booking's facts, the flights, the
 * rest of the journey, photos and the agent. `children` render at the end (the Bookings screen puts "Your other
 * holidays" and "Past holidays" there).
 */
export function BookingDetailView({ id, children }: { id: string; children?: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: booking, isLoading, error, refetch } = usePortalBooking(id);

  if (isLoading) return <BookingLoading />;
  // A malformed id is refused with 400 and everything that is not the customer's own with 404: both read as "not found".
  if (error?.status === 404 || error?.status === 400) return <BookingNotFound />;
  if (error || !booking) {
    return (
      <PortalSection className="py-20 text-center" data-testid="booking-error">
        <p role="alert" className="portal-serif text-[28px] text-primary">
          We couldn&apos;t load this booking.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <PortalButton variant="outline" onClick={() => void refetch()} data-testid="button-booking-retry">
            Try again
          </PortalButton>
          <PortalButton variant="link" onClick={() => setLocation("/portal/bookings")}>
            Back to my bookings
          </PortalButton>
        </div>
      </PortalSection>
    );
  }
  return <BookingBody booking={booking}>{children}</BookingBody>;
}

function factsFor(b: PortalBookingDetail, pax: string) {
  const stay = factsLine(b.numNights, b.board, "");
  const operatorRef = b.operatorName ? `${b.operatorName} reference` : "Operator reference";
  const ref = (value: string) => <span className={`select-all ${WRAP}`}>{value}</span>;
  const items: Array<{ label: string; value: ReactNode; mono?: boolean }> = [
    { label: "Dates", value: formatRange(b.travelDate, b.returnDate) },
    { label: "Stay", value: stay },
    { label: "Travellers", value: pax },
    { label: "Tour operator", value: b.operatorName ?? "" },
    { label: "Booking reference", value: b.bookingReference ? ref(b.bookingReference) : "", mono: true },
    { label: operatorRef, value: b.supplierReference ? ref(b.supplierReference) : "", mono: true },
  ];
  return items.filter((i) => i.value);
}

function BookingBody({ booking: b, children }: { booking: PortalBookingDetail; children?: ReactNode }) {
  const [, setLocation] = useLocation();
  const branding = usePortalBrandingValue();
  const [gallery, setGallery] = useState<GalleryView>(GALLERY_CLOSED);

  const agent = agentFirstName(b.agent.name);
  const title = b.title || "Your holiday";
  const { lead, italic } = splitTitle(title);
  const place = [b.resortName, b.destinationName, b.countryName].filter((v, i, all) => v && all.indexOf(v) === i).join(" · ");
  const dates = formatRange(b.travelDate, b.returnDate);
  const pax = paxLabel(b.adults, b.children, b.infants);
  const countdown = heroCountdown(b.tripStatus, b.daysToGo);
  const photos = useMemo(() => b.images.map((i) => ({ id: i.id, url: i.url })), [b.images]);
  const leadPhoto = b.images.find((i) => i.isPrimary)?.url ?? b.images[0]?.url;
  const journey = useMemo(() => buildJourney(b), [b]);
  const rest = useMemo(() => otherItems(journey), [journey]);
  const facts = useMemo(() => factsFor(b, pax), [b, pax]);

  const messageSheet = usePortalMessageSheet();
  const askAbout = () => messageSheet.open({ kind: "booking", id: b.id });
  const askLabel = agent === "your agent" ? "Ask your agent to add something" : `Ask ${agent} to add something`;

  return (
    <div data-testid="portal-booking">
      <PortalHero className="h-[680px] md:h-[620px]" photoUrl={leadPhoto} contentClassName="gap-4">
        <Eyebrow className="text-accent">My bookings · {b.tripStatus === "past" ? "Travelled" : "Confirmed"}</Eyebrow>
        <h1 className={`portal-serif ${HERO_HEADING_WRAP} font-light leading-none tracking-[-0.01em] text-white`} style={{ fontSize: fitHeroSize(48, b.title) }} data-testid="booking-title">
          {lead}
          {italic && (
            <>
              {" "}
              <br />
              <em className="italic">{italic}</em>
            </>
          )}
        </h1>
        <p className="text-[15px] leading-[1.7] text-white/[0.82]">
          {place}
          {place && dates && <br />}
          {dates}
        </p>
        <p className="mt-1 flex items-baseline gap-2.5" data-testid="booking-countdown">
          {countdown.figure && <span className="portal-serif text-[54px] font-light leading-none">{countdown.figure}</span>}
          <span className="text-[11px] uppercase tracking-[0.3em] text-white/75">{countdown.label}</span>
        </p>
      </PortalHero>

      <PortalSection aria-labelledby="booking-facts" className="pb-6 pt-16">
        <Eyebrow className="mb-3.5">Your booking</Eyebrow>
        <SplitHeading id="booking-facts" lead="All" italic="confirmed." className="mb-[26px]" />
        {facts.length > 0 && (
          <div data-testid="booking-details">
            <FactList items={facts} />
          </div>
        )}
        <PortalButton variant="outline" className="mt-7 w-full" onClick={askAbout} data-testid="button-ask-about-booking">
          {askLabel}
        </PortalButton>
      </PortalSection>

      <BookingPayments enabled={paymentsSectionEnabled(env.portalPayments)} agent={agent} onAsk={() => setLocation("/portal/messages")} />

      {/* The design's next three sections, in order, once their server side exists (see BookingSlots.tsx). */}
      <BookingDocumentsSlot booking={b} />
      <BookingPassportsSlot booking={b} />
      <BookingChecklistSlot booking={b} />

      <BookingFlights items={journey} />

      {rest.length > 0 && (
        <PortalSection aria-labelledby="booking-journey" className="pb-6 pt-16" data-testid="booking-journey-rest">
          <Eyebrow className="mb-3.5">{flightItems(journey).length > 0 ? "Your stay" : "Your journey"}</Eyebrow>
          <SplitHeading id="booking-journey" lead="Everything" italic="included." className="mb-[26px]" />
          <QuoteJourney items={rest} />
        </PortalSection>
      )}

      <PortalSection aria-label="Price" className="flex max-w-md flex-col items-center gap-3.5 pb-6 pt-16 text-center" data-testid="booking-price">
        <Eyebrow>Total{pax ? ` for ${pax}` : ""}</Eyebrow>
        <p className="portal-serif text-[58px] font-light leading-none text-primary" data-testid="booking-total">
          {formatMoney(b.total)}
        </p>
        {b.pricePerPerson > 0 && (
          <p className="text-[15px] text-muted-foreground" data-testid="booking-per-person">
            {formatMoney(b.pricePerPerson)} per person
          </p>
        )}
        <p className="text-[13px] leading-[1.6] text-muted-foreground" data-testid="booking-disclaimer">
          {PRICE_INCLUDES_LINE}
        </p>
      </PortalSection>

      <QuotePhotoStrip images={photos} title={title} onOpen={setGallery} />

      <PortalSection className="py-12" aria-label="Your travel agent">
        <div className="flex items-center gap-4" data-testid="booking-agent">
          {b.agent.avatar ? (
            <img src={b.agent.avatar} alt="" className="size-10 flex-none rounded-full object-cover" />
          ) : (
            <span aria-hidden className="portal-serif flex size-10 flex-none items-center justify-center rounded-full bg-secondary text-base text-primary">
              {b.agent.name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="portal-caps-label">Your travel agent</p>
            <p className="portal-serif text-[24px] leading-[1.2] text-primary" data-testid="booking-agent-name">
              {b.agent.name}
            </p>
            {branding.phone && (
              <a href={`tel:${branding.phone.replace(/\s+/g, "")}`} className="inline-flex min-h-11 items-center text-[15px] text-primary underline underline-offset-4" data-testid="booking-agent-call">
                Call {branding.phone}
              </a>
            )}
          </div>
        </div>
      </PortalSection>

      {children}

      <QuoteGallery images={photos} title={title} place={[b.destinationName, b.countryName].filter(Boolean).join(", ")} view={gallery} onViewChange={setGallery} />
    </div>
  );
}
