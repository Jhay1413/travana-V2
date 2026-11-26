import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { PortalSummary, PortalSummaryNextBooking } from "@shared/portal-summary";
import { fitHeroSize, greetingFor, HERO_HEADING_WRAP, journeyPlace, journeyWhen, nextHolidaySentence, plural, priceHeldLine, rewardsTitle, splitName, type HomeSections as Sections } from "../../lib/home";
import { factsLine, formatDay, formatRange, paxLabel } from "../../lib/quote-format";
import { Eyebrow, PortalButton, PortalHero, PortalSection, SplitHeading } from "../brand";
import type { PortalBranding } from "../../api/portal-branding";

/** The greeting hero: time-of-day greeting, the name split over two lines, and what is coming. A photo only when there is a real one. */
export function HomeHero({ summary, lastName, agent, photo, now }: { summary: PortalSummary; lastName: string | null; agent: string; photo?: string; now: Date }) {
  const { lead, italic } = splitName(summary.firstName, lastName);
  return (
    <PortalHero className="min-h-[260px]" photoUrl={photo}>
      <Eyebrow className="portal-text-amber-soft" as="p">
        <span data-testid="home-greeting-time">{greetingFor(now)}</span>
      </Eyebrow>
      <h1 className={`portal-serif ${HERO_HEADING_WRAP} font-light leading-[1.02] text-white`} style={{ fontSize: fitHeroSize(48, `${lead} ${italic}`) }} data-testid="text-greeting">
        {lead}
        {italic && (
          <>
            <br />
            <em className="italic">{italic}</em>
          </>
        )}
      </h1>
      <p className="max-w-[300px] text-[15px] leading-[1.65] text-white/85" data-testid="home-hero-line">
        Everything {agent} is planning for you.
        {summary.nextBooking && (
          <>
            {" "}
            <span className="font-normal text-white" data-testid="home-next-holiday-line">
              {nextHolidaySentence(summary.nextBooking.daysToGo)}
            </span>
          </>
        )}
      </p>
    </PortalHero>
  );
}

/** Coming up: only things that are real (a held price, rewards). Not rendered at all when there are none. */
export function HomeComingUp({ summary, sections }: { summary: PortalSummary; sections: Sections }) {
  const [, setLocation] = useLocation();
  if (sections.comingUp.length === 0) return null;
  const { priceHeld, rewards } = summary;
  return (
    <PortalSection aria-labelledby="home-coming-up" className="pt-12" data-testid="home-coming-up">
      <Eyebrow as="h2" className="mb-[18px]">
        <span id="home-coming-up">Coming up</span>
      </Eyebrow>
      <div className="grid gap-2.5 md:grid-cols-2">
        {sections.comingUp.includes("priceHeld") && priceHeld && (
          <ReminderCard label="Price held" aside={`until ${formatDay(priceHeld.expiresOn)}`} title={priceHeld.title} testId="home-price-held">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              <span className="text-foreground" data-testid="home-price-held-line">
                {priceHeldLine(priceHeld.daysLeft, priceHeld.total)}
              </span>
              . After that the price may change.
            </p>
            <PortalButton variant="outline" className="mt-1 w-full" onClick={() => setLocation(`/portal/quote/${priceHeld.token}`)} data-testid="home-price-held-view">
              View quote
            </PortalButton>
          </ReminderCard>
        )}
        {sections.comingUp.includes("rewards") && (
          <ReminderCard label="Rewards" aside={rewards.walletCredit > 0 ? "Wallet" : "Referral"} title={rewardsTitle(rewards.walletCredit, rewards.rewardWaiting)} testId="home-rewards">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {rewards.walletCredit > 0 && rewards.rewardWaiting
                ? "A referral reward is waiting for you too."
                : rewards.walletCredit > 0
                  ? "Credit you have earned from referrals."
                  : "Thank you for recommending us. Your reward is ready to collect."}
            </p>
            <PortalButton variant="link" className="self-start text-[11px]" onClick={() => setLocation("/portal/referrals")} data-testid="home-rewards-link">
              Referrals &amp; rewards <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
            </PortalButton>
          </ReminderCard>
        )}
      </div>
    </PortalSection>
  );
}

function ReminderCard({ label, aside, title, testId, children }: { label: string; aside: string; title: ReactNode; testId: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-2.5 border border-border bg-card px-5 py-[22px]" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="portal-eyebrow">{label}</span>
        <span className="portal-serif text-[15px] italic text-muted-foreground">{aside}</span>
      </div>
      <h3 className="portal-serif break-words text-[25px] leading-tight text-primary">{title}</h3>
      {children}
    </article>
  );
}

/** "N quotes to consider" and "N holidays booked": a row is left out when its count is zero. */
export function HomeSummaryRows({ summary, sections, agent }: { summary: PortalSummary; sections: Sections; agent: string }) {
  const [, setLocation] = useLocation();
  const rows = [
    sections.quoteRow && {
      key: "quotes",
      n: summary.counts.quotesAwaiting,
      title: `${plural(summary.counts.quotesAwaiting, "quote")} to consider`,
      sub: agent === "your agent" ? "Put together for you by your agent" : `Put together for you by ${agent}`,
      path: "/portal/trips/quotes",
    },
    sections.bookingRow && {
      key: "bookings",
      n: summary.counts.upcomingBookings,
      title: `${plural(summary.counts.upcomingBookings, "holiday")} booked`,
      sub: "Your confirmed trips",
      path: "/portal/trips/bookings",
    },
  ].filter((r): r is { key: string; n: number; title: string; sub: string; path: string } => !!r);
  if (rows.length === 0) return null;

  return (
    <PortalSection aria-label="Your summary" className="pb-6 pt-12" data-testid="home-summary">
      {rows.map((row, i) => (
        <button
          key={row.key}
          type="button"
          onClick={() => setLocation(row.path)}
          aria-label={`${row.n} ${row.title}`}
          className={`group flex min-h-11 w-full items-center gap-[22px] border-t border-border py-[26px] text-left ${i === rows.length - 1 ? "border-b" : ""}`}
          data-testid={`home-row-${row.key}`}
        >
          <span aria-hidden className="w-14 flex-none portal-serif text-[64px] font-light leading-[0.9] text-primary">
            {row.n}
          </span>
          <span aria-hidden className="flex flex-1 flex-col gap-1.5">
            <span className="portal-serif text-2xl font-medium leading-tight text-primary">{row.title}</span>
            <span className="text-[15px] text-muted-foreground">{row.sub}</span>
          </span>
          <ArrowRight aria-hidden className="size-5 flex-none text-primary transition group-hover:translate-x-1 group-hover:portal-text-amber-ink" strokeWidth={1.5} />
        </button>
      ))}
    </PortalSection>
  );
}

/** "Your next journey": the next booking as a photo block that opens that booking. */
export function HomeNextJourney({ booking }: { booking: PortalSummaryNextBooking }) {
  const [, setLocation] = useLocation();
  const place = journeyPlace(booking.destination, booking.title);
  const pax = paxLabel(booking.adults, booking.children, booking.infants);
  const dates = formatRange(booking.startDate, booking.endDate);
  const facts = factsLine(booking.nights, booking.board, pax);
  return (
    <PortalSection aria-labelledby="home-next-journey" className="flex flex-col gap-[22px] pb-6 pt-16" data-testid="home-next-journey">
      <div className="flex flex-col gap-3">
        <Eyebrow>Your next journey</Eyebrow>
        <SplitHeading id="home-next-journey" lead={`${place},`} italic={journeyWhen(booking.daysToGo)} className="text-[38px] leading-[1.08]" />
      </div>
      <button
        type="button"
        onClick={() => setLocation(`/portal/booking/${booking.id}`)}
        aria-label={`Your next holiday: ${booking.title}, ${dates}. View booking`}
        className="group flex flex-col gap-3.5 text-left"
        data-testid="home-next-booking"
      >
        <span className="relative block h-[320px] w-full overflow-hidden bg-[hsl(var(--portal-navy-deep))]">
          {booking.imageUrl && <img src={booking.imageUrl} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-105" />}
        </span>
        <span className="flex justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="min-w-0 truncate">{booking.destination}</span>
        </span>
        <span className="portal-serif break-words text-[28px] leading-tight text-primary">{booking.title}</span>
        <span className="text-[15px] leading-relaxed text-muted-foreground">
          {dates}
          {facts && <> · {facts}</>}
        </span>
        <span className="pt-1 text-xs uppercase tracking-[0.2em] text-primary group-hover:portal-text-amber-ink">View booking →</span>
      </button>
    </PortalSection>
  );
}

/** A quiet prompt to ask for a holiday, with the button that opens the request sheet. */
export function HomeRequestQuote({ onOpen, intro }: { onOpen: () => void; intro?: string }) {
  return (
    <PortalSection className="flex flex-col items-start gap-4 pb-10 pt-12" data-testid="home-request-quote">
      {intro && (
        <p className="max-w-[420px] text-[17px] leading-[1.65] text-muted-foreground" data-testid="home-first-time-line">
          {intro}
        </p>
      )}
      {!intro && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Somewhere new</Eyebrow>
          <p className="portal-serif text-[26px] leading-tight text-primary">Dreaming of a holiday?</p>
        </div>
      )}
      <PortalButton onClick={onOpen} data-testid="button-request-quote">
        Request a quote
      </PortalButton>
    </PortalSection>
  );
}

/** The agent at the bottom: their name, the agency, and a way to message them. */
export function HomeAgentBlock({ branding, agent }: { branding: PortalBranding; agent: string }) {
  const [, setLocation] = useLocation();
  const named = agent !== "your agent";
  return (
    <section aria-label="Your travel agent" className="mt-10 flex flex-col items-center gap-[18px] bg-secondary px-8 py-[64px] text-center" data-testid="home-agent">
      <Eyebrow>Your travel agent</Eyebrow>
      <p className="portal-serif text-[36px] font-light leading-tight text-primary" data-testid="home-agent-name">
        {named ? branding.agentName : "Your agent"}
      </p>
      {branding.name && (
        <p className="max-w-[300px] text-[15px] leading-[1.7] text-muted-foreground" data-testid="home-agency-name">
          {branding.name}. Ask about any quote, or say where you&apos;d like to go next.
        </p>
      )}
      <PortalButton variant="outline" className="mt-2" onClick={() => setLocation("/portal/messages")} data-testid="home-message-agent">
        {named ? `Message ${agent}` : "Message your agent"}
      </PortalButton>
    </section>
  );
}

