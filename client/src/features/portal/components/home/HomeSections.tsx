import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { PortalSummary, PortalSummaryNextBooking } from "@shared/portal-summary";
import { portalQuoteKeys, usePortalQuoteAction } from "../../api/use-portal-quotes";
import {
  fitHeroSize,
  greetingFor,
  HERO_HEADING_WRAP,
  journeyPlace,
  journeyWhen,
  nextHolidayParts,
  nightsBoardLine,
  plural,
  priceHeldLine,
  rewardsTitle,
  splitName,
  type HomeSections as Sections,
} from "../../lib/home";
import { cn } from "@/lib/utils";
import { factsLine, formatDay, formatRange, paxLabel } from "../../lib/quote-format";
import { Eyebrow, PortalButton, PortalHero, PortalSection, SplitHeading } from "../brand";
import { usePortalMessageSheet } from "../messages/MessageSheet";
import { DeclineSheet } from "../quotes/QuoteSheets";
import type { PortalBranding } from "../../api/portal-branding";

/** The greeting hero: time-of-day greeting, the name split over two lines, and what is coming. A photo only when there is a real one. */
export function HomeHero({ summary, lastName, agent, photo, now }: { summary: PortalSummary; lastName: string | null; agent: string; photo?: string; now: Date }) {
  const { lead, italic } = splitName(summary.firstName, lastName);
  const next = summary.nextBooking ? nextHolidayParts(summary.nextBooking.daysToGo) : null;
  return (
    <PortalHero photoUrl={photo} contentClassName="gap-5 pb-14">
      <Eyebrow className="text-accent" as="p">
        <span data-testid="home-greeting-time">{greetingFor(now)}</span>
      </Eyebrow>
      <h1 className={`portal-serif ${HERO_HEADING_WRAP} font-light leading-none tracking-[-0.01em] text-white`} style={{ fontSize: fitHeroSize(58, `${lead} ${italic}`) }} data-testid="text-greeting">
        {lead}
        {italic && (
          <>
            <br />
            <em className="italic">{italic}</em>
          </>
        )}
      </h1>
      <p className="max-w-[290px] text-[15px] leading-[1.7] text-white/[0.78]" data-testid="home-hero-line">
        Everything {agent} is planning for you.
        {next && (
          <>
            {" "}
            <span data-testid="home-next-holiday-line">
              {next.before}
              <span className="font-normal text-white">{next.strong}</span>
              {next.after}
            </span>
          </>
        )}
      </p>
    </PortalHero>
  );
}

/** Coming up: only things that are real (a held price, rewards). Not rendered at all when there are none. */
export function HomeComingUp({ summary, sections, agent, children }: { summary: PortalSummary; sections: Sections; agent: string; children?: ReactNode }) {
  const [, setLocation] = useLocation();
  // `children` are cards that load their own data and may render nothing; the section hides itself while the grid is empty.
  const grid = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState(sections.comingUp.length);
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const count = () => setCards(el.childElementCount);
    count();
    const observer = new MutationObserver(count);
    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, [sections.comingUp.length, children]);
  if (sections.comingUp.length === 0 && !children) return null;
  const { priceHeld, rewards } = summary;
  return (
    <PortalSection aria-labelledby="home-coming-up" className={cn("px-6 pt-14", cards === 0 && "hidden")} data-testid="home-coming-up">
      <Eyebrow as="h2" className="mx-1 mb-[18px]">
        <span id="home-coming-up">Coming up</span>
      </Eyebrow>
      <div ref={grid} className="grid gap-2.5 md:grid-cols-2">
        {sections.comingUp.includes("priceHeld") && priceHeld && <PriceHeldCard held={priceHeld} agent={agent} />}
        {sections.comingUp.includes("rewards") && (
          <ReminderCard label="Rewards" aside={rewards.walletCredit > 0 ? "Wallet" : "Referral"} title={rewardsTitle(rewards.walletCredit, rewards.rewardWaiting)} testId="home-rewards">
            <p className="text-sm leading-[1.6] text-muted-foreground">
              {rewards.walletCredit > 0 && rewards.rewardWaiting
                ? "A referral reward is waiting for you too."
                : rewards.walletCredit > 0
                  ? "Credit you have earned from referrals."
                  : "Thank you for recommending us. Your reward is ready to collect."}
            </p>
            <PortalButton variant="link" className="self-start text-[11px]" onClick={() => setLocation("/portal/referrals")} data-testid="home-rewards-link">
              Referrals &amp; rewards →
            </PortalButton>
          </ReminderCard>
        )}
        {children}
      </div>
    </PortalSection>
  );
}

/** The design's "Price held" card: "I'm interested" opens the quote, "Not interested" opens the decline sheet right here. */
function PriceHeldCard({ held, agent }: { held: NonNullable<PortalSummary["priceHeld"]>; agent: string }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const action = usePortalQuoteAction(held.token, "");
  const [declineOpen, setDeclineOpen] = useState(false);
  const line = priceHeldLine(held.daysLeft, held.total);
  const at = line.indexOf(" at ");
  const strong = at > 0 ? line.slice(0, at) : line;
  const rest = at > 0 ? line.slice(at) : "";
  return (
    <>
      <ReminderCard label="Price held" aside={`until ${formatDay(held.expiresOn)}`} title={held.title} testId="home-price-held">
        <p className="text-sm leading-[1.6] text-muted-foreground">
          <span data-testid="home-price-held-line">
            <span className="font-normal text-foreground">{strong}</span>
            {rest}
          </span>
          . After that the price may change.
        </p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <PortalButton size="xs" onClick={() => setLocation(`/portal/quote/${held.token}`)} data-testid="home-price-held-view">
            I&apos;m interested
          </PortalButton>
          <PortalButton variant="outline" size="xs" onClick={() => setDeclineOpen(true)} data-testid="home-price-held-decline">
            Not interested
          </PortalButton>
        </div>
      </ReminderCard>
      <DeclineSheet
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        quoteTitle={held.title}
        agent={agent}
        pending={action.isPending}
        failed={action.isError}
        onSubmit={(input) =>
          action.mutate(
            { action: "declined", ...input },
            {
              onSuccess: () => {
                setDeclineOpen(false);
                void queryClient.invalidateQueries({ queryKey: portalQuoteKeys.list });
              },
            },
          )
        }
      />
    </>
  );
}

function ReminderCard({ label, aside, title, testId, children }: { label: string; aside: string; title: ReactNode; testId: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-2.5 border border-border bg-card px-5 py-[22px]" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.24em] portal-text-amber-ink">{label}</span>
        <span className="portal-serif text-[15px] italic text-muted-foreground">{aside}</span>
      </div>
      <h3 className="portal-serif break-words text-[25px] font-normal leading-[1.2] text-primary">{title}</h3>
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
      path: "/portal/quotes",
    },
    sections.bookingRow && {
      key: "bookings",
      n: summary.counts.upcomingBookings,
      title: `${plural(summary.counts.upcomingBookings, "holiday")} booked`,
      sub: "Your confirmed trips",
      path: "/portal/bookings",
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
          <span aria-hidden className="w-[54px] flex-none portal-serif text-[64px] font-light leading-[0.9] text-primary">
            {row.n}
          </span>
          <span aria-hidden className="flex flex-1 flex-col gap-1.5">
            <span className="portal-serif text-2xl font-medium text-primary">{row.title}</span>
            <span className="text-sm text-muted-foreground">{row.sub}</span>
          </span>
          <span aria-hidden className="text-[18px] text-primary group-hover:text-[hsl(var(--portal-amber-ink))]">
            →
          </span>
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
  const stay = nightsBoardLine(booking.nights, booking.board);
  return (
    <PortalSection aria-labelledby="home-next-journey" className="flex flex-col gap-[22px] px-6 pb-6 pt-16" data-testid="home-next-journey">
      <div className="flex flex-col gap-3 px-1">
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
        <span className="relative block h-[420px] w-full overflow-hidden bg-[#0D2A4E]">
          {booking.imageUrl && <img src={booking.imageUrl} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-[1.06]" />}
        </span>
        <span className="flex justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="min-w-0 truncate">{booking.destination}</span>
          {stay && <span className="portal-serif text-[15px] normal-case italic tracking-normal">{stay}</span>}
        </span>
        <span className="portal-serif break-words text-[28px] leading-[1.15] text-primary">{booking.title}</span>
        <span className="text-sm leading-[1.6] text-muted-foreground">
          {dates}
          {facts && <> · {facts}</>}
        </span>
        <span className="pt-1 text-xs font-normal uppercase tracking-[0.28em] text-primary group-hover:text-[hsl(var(--portal-amber-ink))]">View booking →</span>
      </button>
    </PortalSection>
  );
}

/** A quiet prompt to ask for a holiday, with the button that opens the request sheet. */
export function HomeRequestQuote({ onOpen, intro }: { onOpen: () => void; intro?: string }) {
  return (
    <PortalSection className="flex flex-col items-start gap-4 pb-10 pt-12" data-testid="home-request-quote">
      {intro && (
        <p className="max-w-[420px] text-[15px] leading-[1.7] text-muted-foreground" data-testid="home-first-time-line">
          {intro}
        </p>
      )}
      {!intro && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Somewhere new</Eyebrow>
          <p className="portal-serif text-[26px] text-primary">Dreaming of a holiday?</p>
        </div>
      )}
      <PortalButton onClick={onOpen} data-testid="button-request-quote">
        Request a quote
      </PortalButton>
    </PortalSection>
  );
}

/** The agent at the bottom: their name (surname in italics), the agency, and a way to message them. */
export function HomeAgentBlock({ branding, agent }: { branding: PortalBranding; agent: string }) {
  const messageSheet = usePortalMessageSheet();
  const named = agent !== "your agent";
  const [first, ...restWords] = (branding.agentName ?? "").trim().split(/\s+/);
  const surname = restWords.join(" ");
  return (
    <section aria-label="Your travel agent" className="flex flex-col items-center gap-[18px] bg-secondary px-8 py-[76px] text-center" data-testid="home-agent">
      {branding.iconUrl && <img src={branding.iconUrl} alt="" className="block h-auto w-9" />}
      <Eyebrow>Your travel agent</Eyebrow>
      <p className="portal-serif text-[36px] font-light leading-[1.1] text-primary" data-testid="home-agent-name">
        {named ? (
          <>
            {first}
            {surname && (
              <>
                {" "}
                <em className="italic">{surname}</em>
              </>
            )}
          </>
        ) : (
          "Your agent"
        )}
      </p>
      {branding.name && (
        <p className="max-w-[280px] text-sm leading-[1.7] text-muted-foreground" data-testid="home-agency-name">
          {branding.name}. Ask about any quote, or tell {agent} where you&apos;d like to go next.
        </p>
      )}
      <PortalButton variant="outline" className="mt-2" onClick={() => messageSheet.open()} data-testid="home-message-agent">
        {named ? `Message ${agent}` : "Message your agent"}
      </PortalButton>
    </section>
  );
}
