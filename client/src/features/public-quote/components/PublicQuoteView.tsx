import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Eyebrow, PortalHero, PortalSection, ShareIcon, SplitHeading, FactList, PortalButton, portalButtonClass, agentFirstName } from "@/features/portal";
import { QuoteDestination } from "@/features/portal/components/quotes/QuoteDestination";
import { GALLERY_CLOSED, QuoteGallery, QuotePhotoStrip, type GalleryView } from "@/features/portal/components/quotes/QuoteGallery";
import { QuoteJourney } from "@/features/portal/components/quotes/QuoteJourney";
import { fitHeroSize, HERO_HEADING_WRAP } from "@/features/portal/lib/home";
import { buildDestination } from "@/features/portal/lib/quote-destination";
import { factsLine, formatDay, formatRange, paxLabel, PRICE_DISCLAIMER } from "@/features/portal/lib/quote-format";
import { splitTitle } from "@/features/portal/lib/quote-title";
import type { PublicQuoteBlockCode, PublicQuoteData, ShareMethod } from "@/features/quote/api/use-quote-public-queries";
import {
  agencyToBranding,
  buildPublicJourney,
  formatTotal,
  interestedHref,
  placeLine,
  publicDetails,
  publicPhotos,
  quoteTitle,
  returnDay,
  telHref,
} from "../lib/public-quote";
import { PublicQuoteShell } from "./PublicQuoteShell";
import { PublicShareSheet } from "./PublicShareSheet";

/** The one decision a visitor can make here: carry on to the portal, where the real decision buttons are. */
function InterestedLink({ token, className, testId }: { token: string; className?: string; testId: string }) {
  return (
    <a href={interestedHref(token)} className={portalButtonClass("amber", className)} data-testid={testId}>
      I&apos;m interested
    </a>
  );
}

/**
 * The public quote screen in the customer portal's look: hero, photos, price, details, journey, destination and a single
 * "I'm interested" that leads to the portal's sign-in. No decision is taken here and nothing personal is shown.
 */
export function PublicQuoteView({
  quote: q,
  token,
  isStaffPreview = false,
  previewBlock = null,
  onShared,
}: {
  quote: PublicQuoteData;
  token: string;
  isStaffPreview?: boolean;
  previewBlock?: PublicQuoteBlockCode | null;
  /** Each time the visitor starts a share. The page records it (never for a staff preview). */
  onShared: (method: ShareMethod) => void;
}) {
  const [, setLocation] = useLocation();
  const [gallery, setGallery] = useState<GalleryView>(GALLERY_CLOSED);
  const [shareOpen, setShareOpen] = useState(false);

  const branding = useMemo(() => agencyToBranding(q.agency), [q.agency]);
  const agent = agentFirstName(q.agent.name);
  const title = quoteTitle(q);
  const { lead, italic } = splitTitle(title);
  const place = placeLine(q);
  const end = returnDay(q.travelDate, q.numNights);
  const dates = formatRange(q.travelDate, end);
  const pax = paxLabel(q.adults, q.children, q.infants);
  const total = formatTotal(q.totalPrice);
  const perPerson = formatTotal(q.pricePerPerson);
  const { photos, lead: leadPhoto } = useMemo(() => publicPhotos(q.images), [q.images]);
  const journey = useMemo(() => buildPublicJourney(q), [q]);
  const destination = useMemo(() => buildDestination(q.destinationGuru), [q.destinationGuru]);
  const facts = useMemo(() => publicDetails(q), [q]);
  const toLogin = () => setLocation(interestedHref(token));
  const who = agent === "your agent" ? "your agent" : agent;

  const shareButton = (variant: "outline" | "light", testId: string) => (
    <PortalButton variant={variant} size="sm" className="w-full" onClick={() => setShareOpen(true)} data-testid={testId}>
      <ShareIcon /> Share
    </PortalButton>
  );

  return (
    <PublicQuoteShell branding={branding} staffPreview={isStaffPreview && previewBlock !== null}>
      <div data-testid="page-public-quote">
        <PortalHero className="h-[680px] md:h-[620px]" photoUrl={leadPhoto} contentClassName="gap-4">
          {place && <Eyebrow className="text-accent">{place}</Eyebrow>}
          <h1 className={`portal-serif ${HERO_HEADING_WRAP} font-light leading-[1.04] tracking-[-0.01em] text-white`} style={{ fontSize: fitHeroSize(44, title) }} data-testid="text-quote-title">
            {lead}
            {italic && (
              <>
                {" "}
                <br />
                <em className="italic">{italic}</em>
              </>
            )}
          </h1>
          <p className="text-[15px] leading-[1.7] text-white/[0.82]" data-testid="text-passengers">
            {dates}
            {dates && <br />}
            {factsLine(q.numNights || null, q.accommodations[0]?.boardBasis || null, pax)}
          </p>
        </PortalHero>

        {q.expired && (
          <PortalSection className="px-6 pt-6">
            <div role="status" className="flex flex-col gap-2 border border-border bg-card p-5" data-testid="banner-quote-expired">
              <span className="text-[10px] uppercase tracking-[0.24em] portal-text-amber-ink">Price no longer held</span>
              <p className="text-sm leading-[1.6] text-foreground">
                This price was held until {formatDay(q.expiredOn)}. Please contact {q.agent.name ? q.agent.name : "your travel advisor"}
                {q.agency.name ? ` at ${q.agency.name}` : ""} to check it is still available.
              </p>
            </div>
          </PortalSection>
        )}

        <QuotePhotoStrip images={photos} title={title} onOpen={setGallery} />

        <PortalSection aria-label="Price" className="flex max-w-md flex-col items-center gap-3.5 px-8 pb-14 pt-16 text-center" data-testid="quote-price">
          {branding.iconUrl && <img src={branding.iconUrl} alt="" className="mb-2 h-auto w-[34px]" />}
          {total && (
            <>
              <Eyebrow>Total{pax ? ` for ${pax}` : ""}</Eyebrow>
              <p className="portal-serif text-[58px] font-light leading-none text-primary" data-testid="text-total-price">
                {total}
              </p>
              {perPerson && (
                <p className="text-[15px] text-muted-foreground" data-testid="text-price-pp">
                  {perPerson} per person
                </p>
              )}
              <p className="text-[13px] leading-snug text-muted-foreground" data-testid="quote-disclaimer">
                {PRICE_DISCLAIMER}
              </p>
            </>
          )}
          <InterestedLink token={token} className="mt-3.5 w-full" testId="button-interested" />
          {shareButton("outline", "button-share")}
        </PortalSection>

        {facts.length > 0 && (
          <PortalSection aria-labelledby="details" className="pb-6 pt-16">
            <Eyebrow className="mb-3.5">The details</Eyebrow>
            <SplitHeading id="details" lead="Everything," italic="at a glance." className="mb-[26px]" />
            <div data-testid="quote-details">
              <FactList items={facts} />
            </div>
          </PortalSection>
        )}

        <section aria-label="Interested in this holiday" className="portal-bg-navy mt-10 px-6 py-9 text-white" data-testid="quote-decision-bar">
          <div className="mx-auto flex max-w-xl flex-col gap-4">
            {total && (
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.26em] text-white/70">Total{pax ? ` for ${pax}` : ""}</span>
                <span className="portal-serif text-[40px] font-light leading-none" data-testid="quote-bar-total">
                  {total}
                </span>
              </div>
            )}
            <InterestedLink token={token} className="w-full" testId="button-bar-interested" />
            {shareButton("light", "button-bar-share")}
          </div>
        </section>

        {journey.length > 0 && (
          <PortalSection aria-labelledby="journey" className="pb-[72px] pt-16">
            <Eyebrow className="mb-3.5">Your journey</Eyebrow>
            <SplitHeading id="journey" lead="Start to" italic="finish." className="mb-[26px]" />
            <QuoteJourney items={journey} />
          </PortalSection>
        )}

        {destination && <QuoteDestination content={destination} agent={agent} askLabel={`Sign in to ask ${who}`} onAsk={toLogin} />}

        <PortalSection className="py-12" aria-label="Your travel agent">
          <div className="flex items-center gap-4" data-testid="quote-agent">
            {q.agent.avatar ? (
              <img src={q.agent.avatar} alt="" className="size-10 flex-none rounded-full object-cover" data-testid="img-agent-avatar" />
            ) : (
              <span aria-hidden className="portal-serif flex size-10 flex-none items-center justify-center rounded-full bg-secondary text-base text-primary">
                {q.agent.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="portal-caps-label">Your travel agent</p>
              <p className="portal-serif text-[24px] leading-[1.2] text-primary" data-testid="text-agent-name">
                {q.agent.name}
              </p>
              {q.agency.phone && (
                <a href={telHref(q.agency.phone)} className="inline-flex min-h-11 items-center text-[15px] text-primary underline underline-offset-4" data-testid="button-call-agent">
                  Call {q.agency.phone}
                </a>
              )}
            </div>
          </div>
        </PortalSection>

        <section aria-labelledby="interest-title" className="portal-bg-navy px-7 pb-[76px] pt-[84px] text-white" data-testid="quote-interest">
          <div className="mx-auto flex max-w-md flex-col gap-8">
            <div className="flex flex-col items-center gap-4 text-center">
              {branding.iconUrl && <img src={branding.iconUrl} alt="" className="block h-auto w-11 brightness-0 invert" />}
              <p className="portal-eyebrow text-accent">Love this holiday?</p>
              <h2 id="interest-title" className="portal-serif text-[40px] font-light leading-[1.08]">
                Let {who}
                <br />
                <em className="italic">know.</em>
              </h2>
              <p className="max-w-[300px] text-sm leading-[1.7] text-white/75">
                {total ? `They'll check it's still available at ${total}, then help you book.` : "They'll check it's still available, then help you book."}
              </p>
            </div>
            <InterestedLink token={token} className="min-h-[58px] w-full" testId="button-interested-submit" />
            <p className="text-center text-[13px] text-white/60" data-testid="interest-signin-note">
              You&apos;ll be asked to sign in so {who} knows it&apos;s you.
            </p>
          </div>
        </section>

        <QuoteGallery
          images={photos}
          title={title}
          place={[q.destinationName, q.countryName].filter(Boolean).join(", ")}
          view={gallery}
          onViewChange={setGallery}
          onInterested={toLogin}
        />

        <PublicShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          title={title}
          dates={dates}
          token={token}
          imageUrl={leadPhoto ?? ""}
          total={total}
          agencyName={q.agency.name}
          onShared={onShared}
        />
      </div>
    </PublicQuoteShell>
  );
}
