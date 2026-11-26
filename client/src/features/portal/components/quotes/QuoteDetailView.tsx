import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import type { PortalQuoteDetail } from "@shared/portal-quotes";
import { usePortalUser } from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import { BookedQuoteError, useLogPortalQuoteOpened, usePortalQuote, usePortalQuoteAction, useRecordQuoteShare } from "../../api/use-portal-quotes";
import { bookedLink } from "../../lib/booking-format";
import { canShowDecisionControls, declinedSentence } from "../../lib/quote-decision";
import { buildDestination } from "../../lib/quote-destination";
import { agentFirstName, factsLine, formatDay, formatMoney, formatRange, paxLabel, PRICE_DISCLAIMER, uniqueNames } from "../../lib/quote-format";
import { heldUntilLine } from "../../lib/quote-held";
import { buildJourney } from "../../lib/quote-journey";
import { fitHeroSize, HERO_HEADING_WRAP } from "../../lib/home";
import { aboutParam } from "../../lib/message-prefill";
import { splitTitle } from "../../lib/quote-title";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { Eyebrow, FactList, PortalButton, PortalHero, PortalSection, SplitHeading } from "../brand";
import { QuoteActionBar } from "./QuoteActionBar";
import { QuoteDestination } from "./QuoteDestination";
import { GALLERY_CLOSED, QuoteGallery, QuotePhotoStrip, type GalleryView } from "./QuoteGallery";
import { QuoteJourney } from "./QuoteJourney";
import { DeclineSheet, ShareSheet } from "./QuoteSheets";

const TEXT_AREA =
  "min-h-[88px] w-full resize-y rounded-none border border-white/60 bg-transparent p-3 text-[16px] leading-relaxed text-white placeholder:text-white/70 focus-visible:border-accent focus-visible:outline-none";

function QuoteNotFound() {
  const [, setLocation] = useLocation();
  return (
    <PortalSection className="py-20 text-center" data-testid="quote-not-found">
      <Eyebrow>Quote not found</Eyebrow>
      <SplitHeading as="h1" lead="We can't find" italic="that quote." className="mt-3 text-[40px] leading-[1.08]" />
      <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground">
        The link may be out of date, or the quote isn&apos;t on your account. Your own quotes are all in one place.
      </p>
      <PortalButton className="mt-6" onClick={() => setLocation("/portal/trips/quotes")} data-testid="button-back-to-quotes">
        Back to my quotes
      </PortalButton>
    </PortalSection>
  );
}

/** The customer's own quote, now a booking: their old link lands here, with the way to the booking. */
function QuoteBooked({ bookingId }: { bookingId: string | null }) {
  const [, setLocation] = useLocation();
  return (
    <PortalSection className="py-20 text-center" data-testid="quote-booked">
      <Eyebrow>Booked</Eyebrow>
      <SplitHeading as="h1" lead="This holiday" italic="is booked." className="mt-3 text-[40px] leading-[1.08]" />
      <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground">
        Good news: this one has been confirmed, so the quote is closed. Your booking is under Trips.
      </p>
      <PortalButton className="mt-6" onClick={() => setLocation(bookedLink(bookingId))} data-testid="button-quote-booked-bookings">
        {bookingId ? "View my booking" : "View my bookings"}
      </PortalButton>
    </PortalSection>
  );
}

function QuoteLoading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading your quote" data-testid="quote-loading">
      <div className="h-[320px] bg-secondary" />
      <div className="mx-auto mt-8 max-w-3xl space-y-4 px-7">
        <div className="h-4 w-1/3 bg-secondary" />
        <div className="h-10 w-3/4 bg-secondary" />
        <div className="h-4 w-1/2 bg-secondary" />
      </div>
    </div>
  );
}

function detailsFor(q: PortalQuoteDetail, pax: string) {
  const outbound = q.flights.find((f) => f.flightType === "outbound") ?? q.flights[0];
  // The same hotel booked in two stays is one name here (the journey still lists each stay).
  const hotels = uniqueNames(q.accommodations.map((a) => a.name));
  const first = q.accommodations[0];
  const transfer = q.transferType && q.transferType.toLowerCase() !== "none" ? q.transferType : "";
  const items: Array<{ label: string; value: string }> = [
    { label: "Travel dates", value: formatRange(q.travelDate, q.returnDate) },
    { label: "Departure airport", value: outbound?.departingAirport ?? "" },
    { label: hotels.length > 1 ? "Hotels" : "Hotel", value: hotels.join(", ") },
    { label: "Room", value: first?.roomType ?? "" },
    { label: "Board", value: first?.boardBasis ?? "" },
    { label: "Nights", value: q.numNights > 0 ? `${q.numNights} night${q.numNights === 1 ? "" : "s"}` : "" },
    { label: "Passengers", value: pax ? pax.charAt(0).toUpperCase() + pax.slice(1) + (q.pets > 0 ? `, ${q.pets} pet${q.pets === 1 ? "" : "s"}` : "") : "" },
    { label: "Transfer", value: transfer },
    { label: "In-flight meals", value: q.flightMeals ? "Included" : "" },
    { label: "Pre-booked seats", value: q.preBookedSeats },
    { label: "Tour operator", value: q.operatorName ?? "" },
    { label: "Holiday type", value: q.holidayType },
  ];
  return items.filter((i) => i.value);
}

/** The new-look quote: hero, photos, price, highlights, details, journey, destination and the customer's decision. */
export function QuoteDetailView({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const { data: quote, isLoading, error } = usePortalQuote(token);

  if (isLoading) return <QuoteLoading />;
  if (error?.code === "BOOKED") return <QuoteBooked bookingId={error instanceof BookedQuoteError ? error.bookingId : null} />;
  if (error?.status === 404) return <QuoteNotFound />;
  if (error || !quote) {
    return (
      <PortalSection className="py-20 text-center" data-testid="quote-error">
        <p role="alert" className="portal-serif text-[28px] text-primary">
          We couldn&apos;t load this quote.
        </p>
        <PortalButton variant="outline" className="mt-5" onClick={() => setLocation("/portal/trips/quotes")}>
          Back to my quotes
        </PortalButton>
      </PortalSection>
    );
  }
  return <QuoteBody quote={quote} token={token} />;
}

function QuoteBody({ quote: q, token }: { quote: PortalQuoteDetail; token: string }) {
  const [, setLocation] = useLocation();
  const branding = usePortalBrandingValue();
  const { data: user } = usePortalUser();
  const action = usePortalQuoteAction(token, q.id);
  const logOpened = useLogPortalQuoteOpened();
  const recordShare = useRecordQuoteShare();

  const [gallery, setGallery] = useState<GalleryView>(GALLERY_CLOSED);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [note, setNote] = useState("");

  // Tell the agent the customer opened it, once per visit.
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logOpened.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const agent = agentFirstName(q.agent.name);
  const title = q.title || [q.destinationName, q.countryName].filter(Boolean).join(", ") || "Your holiday";
  const { lead, italic } = splitTitle(title);
  const place = [q.resortName, q.destinationName, q.countryName].filter((v, i, all) => v && all.indexOf(v) === i).join(" · ");
  const dates = formatRange(q.travelDate, q.returnDate);
  const pax = paxLabel(q.adults, q.children, q.infants);
  const held = heldUntilLine(q.expiryDate);
  const photos = useMemo(() => q.images.map((i) => ({ id: i.id, url: i.url })), [q.images]);
  const leadPhoto = q.images.find((i) => i.isPrimary)?.url ?? q.images[0]?.url;
  const journey = useMemo(() => buildJourney(q), [q]);
  const destination = useMemo(() => buildDestination(q.destinationGuide), [q.destinationGuide]);
  const facts = useMemo(() => detailsFor(q, pax), [q, pax]);

  const decision = q.decision;
  const showBar = canShowDecisionControls(q);
  const askAbout = () => setLocation(`/portal/messages?about=${aboutParam(title)}`);

  const interested = () => action.mutate({ action: "interested", note: note.trim() || undefined });
  const declineFailed = action.isError && action.variables?.action === "declined";

  return (
    <div className={cn(showBar && "pb-40")} data-testid="portal-quote">
      <PortalHero className="min-h-[400px]" photoUrl={leadPhoto}>
        {place && <Eyebrow className="portal-text-amber-soft">{place}</Eyebrow>}
        <h1 className={`portal-serif ${HERO_HEADING_WRAP} font-light leading-[1.06] text-white`} style={{ fontSize: fitHeroSize(42, q.title) }} data-testid="quote-title">
          {lead}
          {italic && (
            <>
              {" "}
              <br />
              <em className="italic">{italic}</em>
            </>
          )}
        </h1>
        <p className="text-[15px] leading-[1.7] text-white/85">
          {dates}
          {dates && <br />}
          {factsLine(q.numNights || null, q.accommodations[0]?.boardBasis || null, pax)}
        </p>
      </PortalHero>

      {decision.state === "declined" && (
        <PortalSection className="pt-6">
          <div role="status" className="flex flex-col gap-2 border border-border bg-card p-5" data-testid="quote-declined-banner">
            <span className="portal-caps-label portal-text-amber-ink">Not for you</span>
            <p className="text-[15px] leading-relaxed">{declinedSentence(decision, agent)}</p>
            {action.isError && action.variables?.action === "reopened" && (
              <p role="alert" className="portal-text-danger text-[15px]">
                That didn&apos;t work. Try again.
              </p>
            )}
            <PortalButton variant="link" className="self-start" disabled={action.isPending} onClick={() => action.mutate({ action: "reopened" })} data-testid="button-undo-decline">
              Undo
            </PortalButton>
          </div>
        </PortalSection>
      )}

      <QuotePhotoStrip images={photos} title={title} onOpen={setGallery} />

      <PortalSection aria-label="Price" className="flex max-w-md flex-col items-center gap-3.5 pb-14 pt-16 text-center" data-testid="quote-price">
        <Eyebrow>Total{pax ? ` for ${pax}` : ""}</Eyebrow>
        <p className="portal-serif text-[56px] font-light leading-none text-primary" data-testid="quote-total">
          {formatMoney(q.total)}
        </p>
        <p className="text-[15px] text-muted-foreground">
          {[q.pricePerPerson > 0 ? `${formatMoney(q.pricePerPerson)} per person` : "", q.operatorName ?? ""].filter(Boolean).join(" · ")}
        </p>
        {held && (
          <>
            <div aria-hidden className="my-1 h-px w-10 bg-accent" />
            <p className="portal-serif max-w-[300px] text-[19px] italic leading-snug text-primary" data-testid="quote-held">
              {held.text}
              {held.held ? ". After that it may change." : "."}
            </p>
          </>
        )}
        <p className="text-[13px] leading-snug text-muted-foreground" data-testid="quote-disclaimer">
          {PRICE_DISCLAIMER}
        </p>
        <div className={cn("mt-3 grid w-full gap-2", q.canShare ? "grid-cols-2" : "grid-cols-1")}>
          {q.canDecide && decision.state !== "declined" ? (
            <PortalButton variant="outline" className="px-4" onClick={() => setDeclineOpen(true)} data-testid="button-not-interested">
              Not interested
            </PortalButton>
          ) : (
            <PortalButton variant="outline" className="px-4" onClick={askAbout} data-testid="button-ask-inline">
              Ask {agent}
            </PortalButton>
          )}
          {q.canShare && (
            <PortalButton variant="outline" className="px-4" onClick={() => setShareOpen(true)} data-testid="button-share">
              Share
            </PortalButton>
          )}
        </div>
      </PortalSection>

      {q.tags.length > 0 && (
        <PortalSection aria-label="Highlights" className="pb-6">
          <ul className="flex flex-wrap justify-center gap-2" data-testid="quote-highlights">
            {q.tags.map((t) => (
              <li key={t} className="border border-border px-3.5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                {t}
              </li>
            ))}
          </ul>
        </PortalSection>
      )}

      {facts.length > 0 && (
        <PortalSection aria-labelledby="details" className="pt-16">
          <Eyebrow className="mb-3.5">The details</Eyebrow>
          <SplitHeading id="details" lead="Everything," italic="at a glance." className="mb-[26px]" />
          <div data-testid="quote-details">
            <FactList items={facts} />
          </div>
        </PortalSection>
      )}

      {journey.length > 0 && (
        <PortalSection aria-labelledby="journey" className="pb-[72px] pt-16">
          <Eyebrow className="mb-3.5">Your journey</Eyebrow>
          <SplitHeading id="journey" lead="Start to" italic="finish." className="mb-[26px]" />
          <QuoteJourney items={journey} />
        </PortalSection>
      )}

      {destination && <QuoteDestination content={destination} askLabel={`Ask ${agent} to add something`} onAsk={askAbout} />}

      <PortalSection className="py-12" aria-label="Your travel agent">
        <div className="flex items-center gap-4" data-testid="quote-agent">
          {q.agent.avatar ? (
            <img src={q.agent.avatar} alt="" className="size-14 flex-none rounded-full object-cover" />
          ) : (
            <span aria-hidden className="portal-serif flex size-14 flex-none items-center justify-center rounded-full bg-secondary text-[24px] text-primary">
              {q.agent.name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="portal-caps-label">Your travel agent</p>
            <p className="portal-serif text-[24px] leading-tight text-primary" data-testid="quote-agent-name">
              {q.agent.name}
            </p>
            {branding.phone && (
              <a href={`tel:${branding.phone.replace(/\s+/g, "")}`} className="inline-flex min-h-11 items-center text-[15px] text-primary underline underline-offset-4" data-testid="quote-agent-call">
                Call {branding.phone}
              </a>
            )}
          </div>
        </div>
        <PortalButton variant="outline" className="mt-4 w-full" onClick={askAbout} data-testid="button-ask-agent">
          Ask {agent} about this quote
        </PortalButton>
      </PortalSection>

      {q.canDecide && decision.state !== "declined" && (
        <section id="interest" aria-labelledby="interest-title" className="portal-bg-navy px-7 pb-[76px] pt-[84px] text-white" data-testid="quote-interest">
          <div className="mx-auto max-w-md">
            {decision.state === "interested" ? (
              <div role="status" className="flex flex-col items-center gap-[22px] text-center" data-testid="quote-thanks">
                <p className="portal-eyebrow portal-text-amber-soft">{agent === "your agent" ? "Your agent has been told" : `${agent} has been told`}</p>
                <h2 id="interest-title" className="portal-serif text-[42px] font-light leading-[1.08]">
                  Thank you{user?.firstName ? "," : "."}
                  {user?.firstName && (
                    <>
                      <br />
                      <em className="italic">{user.firstName}.</em>
                    </>
                  )}
                </h2>
                <div aria-hidden className="h-px w-10 bg-accent" />
                <p className="max-w-[300px] text-[15px] leading-[1.7] text-white/85">
                  {agent === "your agent" ? "Your agent" : agent} will check {title} is still available and be in touch soon.
                  {decision.at ? ` Sent ${formatDay(decision.at)}.` : ""}
                </p>
                {decision.note && <p className="portal-serif max-w-[300px] text-[19px] italic leading-snug">&ldquo;{decision.note}&rdquo;</p>}
                <PortalButton variant="light" onClick={() => setLocation("/portal/trips/quotes")} data-testid="button-thanks-back">
                  Back to my quotes
                </PortalButton>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <p className="portal-eyebrow portal-text-amber-soft">Love this holiday?</p>
                  <h2 id="interest-title" className="portal-serif text-[40px] font-light leading-[1.08]">
                    Let {agent === "your agent" ? "your agent" : agent}
                    <br />
                    <em className="italic">know.</em>
                  </h2>
                  <p className="max-w-[300px] text-[15px] leading-[1.7] text-white/85">
                    They&apos;ll check it&apos;s still available at {formatMoney(q.total)}, then help you book.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="interest-note" className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/85">
                    Anything to change? (optional)
                  </label>
                  <textarea
                    id="interest-note"
                    rows={2}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="A sea view, perhaps, or a later flight"
                    className={TEXT_AREA}
                    data-testid="input-interest-note"
                  />
                </div>
                {action.isError && action.variables?.action === "interested" && (
                  <p role="alert" className="text-[15px] text-[hsl(var(--portal-amber-soft))]" data-testid="interest-error">
                    That didn&apos;t send. Please try again.
                  </p>
                )}
                <PortalButton className="min-h-[58px] w-full" disabled={action.isPending} onClick={interested} data-testid="button-interested-submit">
                  {action.isPending && action.variables?.action === "interested" ? "Sending" : "I'm interested"}
                </PortalButton>
                <PortalButton variant="link" className="-mt-3 self-center text-white/85 hover:text-white" onClick={() => setDeclineOpen(true)}>
                  Not for me
                </PortalButton>
                <p className="text-center text-[15px] text-white/75">
                  Quote from {q.agent.name}
                  {q.sentAt ? ` · ${formatDay(q.sentAt)}` : ""}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {showBar && (
        <QuoteActionBar
          total={q.total}
          pending={action.isPending}
          onInterested={interested}
          onNotInterested={() => setDeclineOpen(true)}
          onShare={() => setShareOpen(true)}
        />
      )}

      <QuoteGallery images={photos} title={title} view={gallery} onViewChange={setGallery} />

      <DeclineSheet
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        quoteTitle={title}
        agent={agent}
        pending={action.isPending && action.variables?.action === "declined"}
        failed={declineFailed}
        onSubmit={(input) => action.mutate({ action: "declined", ...input }, { onSuccess: () => setDeclineOpen(false) })}
      />

      {q.canShare && (
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={title}
        dates={dates}
        token={token}
        imageUrl={leadPhoto ?? ""}
        agencyName={branding.name}
        agent={agent}
        onShared={(method) => recordShare.mutate({ token, method })}
      />
      )}
    </div>
  );
}
